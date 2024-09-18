import {
    DynamoDBClient,
    GetItemCommand,
    TransactWriteItemsCommand,
    TransactWriteItem,
  } from "@aws-sdk/client-dynamodb";
  import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
  
  const dynamoDb = new DynamoDBClient({});
  const VOLUNTEER_SIGNUP_TABLE_NAME = process.env.VOLUNTEER_SIGNUP_TABLE_NAME || "";
  const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME || "";
  
  export const handler = async (event: any) => {
    try {
      const { eventId, volunteerId, assignedRole, action } = JSON.parse(event.body);
      const managerId = event.requestContext.authorizer.claims.sub;
      const userGroups = event.requestContext.authorizer.claims["cognito:groups"] || [];
  
      // Check if user has Manager role
      if (!userGroups.includes("Managers")) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            success: false,
            error: "Unauthorized: Only Managers can confirm volunteers.",
          }),
        };
      }
  
      // Validate input
      if (!eventId || !volunteerId || !assignedRole || !action) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: "Event ID, Volunteer ID, Assigned Role, and Action are required.",
          }),
        };
      }
  
      if (!["approve", "reject"].includes(action)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: "Action must be 'approve' or 'reject'.",
          }),
        };
      }
  
      // Fetch event details
      const eventParams = {
        TableName: EVENTS_TABLE_NAME,
        Key: { PK: { S: eventId } },
      };
      const eventResponse = await dynamoDb.send(new GetItemCommand(eventParams));
  
      if (!eventResponse.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            error: `Event with ID ${eventId} does not exist.`,
          }),
        };
      }
  
      const eventData = unmarshall(eventResponse.Item);
  
      // Fetch current VolunteerSignUp status
      const volunteerParams = {
        TableName: VOLUNTEER_SIGNUP_TABLE_NAME,
        Key: { PK: { S: eventId }, SK: { S: volunteerId } },
      };
      const volunteerResponse = await dynamoDb.send(new GetItemCommand(volunteerParams));
  
      if (!volunteerResponse.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            error: `Volunteer sign-up not found for event ${eventId} and volunteer ${volunteerId}.`,
          }),
        };
      }
  
      const volunteerData = unmarshall(volunteerResponse.Item);
      const currentStatus = volunteerData.status;
  
      // Determine if count needs adjustment
      let countAdjustment = 0;
      if (currentStatus === "approved" && action === "reject") {
        countAdjustment = -1;
      } else if (currentStatus !== "approved" && action === "approve") {
        // Check capacity
        const currentCount =
          assignedRole === "exec"
            ? eventData.approvedExecCount
            : eventData.approvedStandardCount;
        const availableSpots =
          assignedRole === "exec"
            ? eventData.availableSpotsExec
            : eventData.availableSpotsStandard;
  
        if (currentCount >= availableSpots) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              success: false,
              error: `Cannot approve volunteer: No available spots for ${assignedRole} volunteers.`,
            }),
          };
        }
        countAdjustment = 1;
      }
  
      // Use DynamoDB transactions to update both tables atomically
      const transactParams: {
        TransactItems: TransactWriteItem[];
      } = {
        TransactItems: [],
      };
  
      // First Update: VolunteerSignUp Table
      const volunteerUpdate: TransactWriteItem = {
        Update: {
          TableName: VOLUNTEER_SIGNUP_TABLE_NAME,
          Key: { PK: { S: eventId }, SK: { S: volunteerId } },
          UpdateExpression:
            "SET #status = :newStatus, assignedRole = :assignedRole, reviewedBy = :reviewedBy, reviewedAt = :reviewedAt",
          ConditionExpression:
            "attribute_exists(PK) AND attribute_exists(SK) AND #status = :currentStatus",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":newStatus": { S: action === "approve" ? "approved" : "rejected" },
            ":assignedRole": { S: assignedRole },
            ":reviewedBy": { S: managerId },
            ":reviewedAt": { N: Date.now().toString() },
            ":currentStatus": { S: currentStatus },
          },
        },
      };
      transactParams.TransactItems.push(volunteerUpdate);
  
      // Second Update: Events Table (if count needs adjustment)
      if (countAdjustment !== 0) {
        const countField =
          assignedRole === "exec"
            ? "approvedExecCount"
            : "approvedStandardCount";
  
        const eventUpdate: TransactWriteItem = {
          Update: {
            TableName: EVENTS_TABLE_NAME,
            Key: { PK: { S: eventId } },
            UpdateExpression: "ADD #countField :increment",
            ExpressionAttributeNames: {
              "#countField": countField,
            },
            ExpressionAttributeValues: {
              ":increment": { N: countAdjustment.toString() },
            },
          },
        };
        transactParams.TransactItems.push(eventUpdate);
      }
  
      // Execute the transaction
      await dynamoDb.send(new TransactWriteItemsCommand(transactParams));
  
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Volunteer ${volunteerId} ${action}d for event ${eventId} as ${assignedRole}.`,
        }),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: `Could not confirm volunteer: ${errorMessage}`,
        }),
      };
    }
  };
  