
# 🐾 openAnimalRescue Backend

Welcome to **openAnimalRescue**! 🐶🐱 An open-source project dedicated to empowering animal rescue organisations by providing powerful tools for organising animal information and standardising adoption processes.

## Vision and Mission

**🌟 Vision**: To empower animal rescue organisations to better manage their information and streamline their adoption processes.

**🎯 Mission**: To deliver these tools as quickly as possible, enabling organisations to provide feedback and contributions, thereby enhancing the system for everyone's benefit.

## About openAnimalRescue

**openAnimalRescue** is built using the AWS CDK framework and TypeScript, making it a robust, approachable, and scalable backend solution. The backend is decoupled from the frontend, allowing you to integrate it with the frontend of your choice. You can start with the backend and then focus on the frontend in any order that best suits your project.

The data layer is built using **DynamoDB**. After considering the pros and cons of SQL vs. NoSQL, I decided to take a more agnostic approach and start with DynamoDB. This offers the advantage of getting up and running quickly with minimal setup costs. DynamoDB provides generous free usage, making it a cost-effective choice for organisations starting out. 

That said, I highly recommend following the **AWS Well-Architected Framework** when setting up your AWS account, especially the **Cost Optimization** pillar. Be sure to set up cost alarms—both a static threshold based on your budget and a dynamic threshold based on average usage. Keeping both alarms active ensures you’re aware when you're trending over budget or significantly deviating from expected costs.

As the project evolves, and depending on community feedback, we may explore more configuration-driven approaches that could allow flexibility in database choices, including relational systems like Postgres, for those who prefer a more structured approach.

### Key Features

- **🚀 Serverless Architecture**: openAnimalRescue is designed to be highly scalable and cost-efficient using serverless technologies.
- **☁️ AWS Deployment**: By default, openAnimalRescue is optimised for deployment on AWS, leveraging the power of DynamoDB for fast and flexible data storage.
- **🔧 Extensibility**: Developers can easily extend and adapt the codebase to deploy on other cloud providers or infrastructures.

## 🚀 Deploying

1. **🔄 Clone the Repository**: `git clone git@github.com:jordlevy/openanimalrescue-backend.git`
2. **📦 Install AWS CDK**: `npm install -g aws-cdk`
3. **🚀 Deploy to AWS**: 
    ```bash
    cd openanimalrescue-backend
    # cdk bootstrap aws://<your target AWS account ID here>/<your preferred region here> (only if needed)
    # i.e. cdk bootstrap aws://111222333/eu-west-1
    npx cdk deploy
    ```

## Useful Commands

* `npm run build`   compile TypeScript to JS
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the Jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesised CloudFormation template

### Contributions

Contributions from the community are welcome! If you have ideas, feedback, or code to contribute, feel free to get involved.

### Acknowledgements

This project is powered by AWS CDK and DynamoDB. 💪 A big thanks to the AWS CDK team for making serverless applications accessible, and DynamoDB for enabling fast and efficient data handling.

### License

This project is licensed under the GNU GPL v3 license, which specifically prohibits closed-source derivatives.

Enjoy!
