
# 🐾 openAnimalRescue

Welcome to **openAnimalRescue**! 🐶🐱 An open-source project dedicated to empowering animal rescue organisations by providing powerful tools for organising animal information and standardising adoption processes.

## Vision and Mission

**🌟 Vision**: To empower animal rescue organisations to better manage their information and streamline their adoption processes.

**🎯 Mission**: To deliver these tools as quickly as possible, enabling organisations to provide feedback and contributions, thereby enhancing the system for everyone's benefit.

## About openAnimalRescue

**openAnimalRescue** is built using the AWS CDK framework and Go, making it a robust and scalable backend solution. This is the main element of the project, driving whichever frontend you choose to integrate with it. The beauty here is that they're separate concerns. You can spin up a backend and tackle whichever frontend element you want in whichever order suits you.

The data layer is Postgres. Initially, I considered NoSQL, but I quickly realized that this project is going to be very relation-driven. My preference with relational data is Postgres, so that's what I'll be going ahead with.

### Key Features

- **🚀 Serverless Architecture**: Leveraging the power and flexibility of Serverless, openAnimalRescue is designed to be highly scalable and cost-efficient.
- **☁️ AWS Deployment**: By default, openAnimalRescue is optimized for deployment on AWS.
- **🔧 Extensibility**: Independent developers can easily adapt the code to deploy on other cloud providers or infrastructures.

### Getting Started

To get started with openAnimalRescue, follow these steps:

## Sort the Bootstrap Files

When working on a new route, you need to create a corresponding bootstrap file. This is a simple shell script that calls `/bin/sh` and then executes the compiled binary for the route.

For example, if you're working on the `/health` route, your bootstrap file would look like this:

\`\`\`sh
#!/bin/sh
./health
\`\`\`

At some point, I will create a library of these in the repo so it becomes a copy-paste job.

## 🚀 Sort the Bootstrap Files 🚀

1. **🔄 Clone the Repository**: \`git clone git@github.com:jordlevy/openanimalrescue-backend.git\`
2. **📦 Install Serverless Framework**: \`npm install -g aws-cdk\`
3. **🚀 Deploy to AWS**: 
    \`\`\`bash
    cd openanimalrescue-api
    #cdk bootstrap aws://<your target AWS account ID here>/<your preferred region here> (only if needed)
    cdk deploy
    \`\`\`

### Contributions

I welcome contributions from the community! If you have ideas, feedback, or code to contribute, feel free to get involved.

### Acknowledgements

This project is powered by AWS CDK. 💪 A huge thanks to the AWS CDK team for their amazing work in making serverless applications accessible and efficient.

### License

This project is licensed under the GNU GPL v3 license, which specifically prohibits closed source derivatives.
