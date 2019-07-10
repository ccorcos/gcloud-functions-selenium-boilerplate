# Telegram Translator

Resources
- https://www.toptal.com/nodejs/serverless-nodejs-using-google-cloud
- https://cloud.google.com/functions/docs/writing/

Google Cloud Setup
- Signup: https://console.cloud.google.com
- Create a project
- `brew cask install google-cloud-sdk`=
- `gcloud auth login`
- `gcloud projects list`
- `gcloud config set project translator-246304`

Deploying
- https://cloud.google.com/functions/docs/deploying/filesystem
- build: `npm run build`
- `gcloud functions deploy translate --runtime nodejs10 --entry-point default --trigger-http`