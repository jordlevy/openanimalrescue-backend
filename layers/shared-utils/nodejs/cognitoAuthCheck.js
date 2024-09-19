/**
 * Checks if the user belongs to any of the allowed groups.
 *
 * @param {Object} event - The API Gateway event object.
 * @param {string[]} allowedGroups - Array of group names that are allowed to access the function.
 * @returns {boolean} - Returns true if the user is authorized, false otherwise.
 */
const isUserAuthorized = (event, allowedGroups) => {
    const claims = event.requestContext?.authorizer?.claims;
    
    if (!claims) {
      console.warn("Authorization claims are missing in the event.");
      return false;
    }
  
    const userGroupsString = claims["cognito:groups"];
    const userGroups = userGroupsString ? userGroupsString.split(",") : [];
  
    const isAuthorized = allowedGroups.some(group => userGroups.includes(group));
  
    if (!isAuthorized) {
      console.warn(`User does not belong to any of the allowed groups: ${allowedGroups.join(", ")}`);
    }
  
    return isAuthorized;
  };
  
  module.exports = {
    isUserAuthorized,
  };
  