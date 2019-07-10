# Google Cloud Function Boilerplate

## Setup
- [Signup for Google Cloud](https://console.cloud.google.com)
- Create a new project project.
- Install the `gcloud` cli tool.
	```sh
	brew cask install google-cloud-sdk
	```
- Login
	```sh
	gcloud auth login
	```
- Find the project id you just created and set it as the current project.
	```sh
	gcloud projects list
	gcloud config set project translator-246304
	```

## Deploying
- [Read about it here](https://cloud.google.com/functions/docs/deploying/filesystem)
- Build the TypeScript files:
	```sh
	npm run build
	```
- Edit the package.json deploy script to reference the name of the function you want to deploy. Currently, it's called `translate`.
- Deploy
	```sh
	npm run deploy
	```
- The deployment should log an endpoint url that you can test.
	```sh
	curl https://us-central1-translator-246304.cloudfunctions.net/translate
	```

## Resources
- https://www.toptal.com/nodejs/serverless-nodejs-using-google-cloud
- https://cloud.google.com/functions/docs/writing/

