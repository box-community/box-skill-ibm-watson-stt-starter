<img src="images/box-dev-logo-clip.png" 
alt= “box-dev-logo” 
style="margin-left:-10px;"
width=40%;>
# IBM Watson Box Skill Demo
This repository contains an example GCP function that accepts a Box Skill invocation and calls the IBM Watson STT service.

**Note: You will need to add a gcp crendentials file and update the serverless.yml with that appropriate connection information.**

If you would rather, you can follow along on the [Medium blog](https://medium.com/box-developer-blog/box-skills-ibm-watson-speech-to-text-tutorial-b7e3b3c0a8c7) for more in depth setup instructions.

## Steps to Setup and Deploy

0. You will need to set up a Box Skill in the Box Developer Console, as well as authorize the skill and configure a folder to watch for uploads. You can find out more about that process in our [developer documentation](https://developer.box.com/guides/applications/custom-skills/setup/). 
1. Install Node v10.0.0 or higher
2. [Set up a Google Cloud Account](https://serverless.com/framework/docs/providers/google/guide/credentials/)
3. Download the code.
4. Add your google keyfile to the .gcloud folder and name it serverless.json.
5. Set up an [IBM Watson STT service](https://cloud.ibm.com/docs/speech-to-text?topic=speech-to-text-gettingStarted#getting-started-before-you-begin-cloud)
6. Update any connection and configuration information in the serverless.yml and package.json files. This includes updating the keywords to look for list.
7. Run `npm install`
8. Run `sls deploy`
9. Once the deploy is complete, copy the invocation URL and paste it into the Box Skill configuration section. Click Save.
10. After deploying, in the GCP console, you'll need to allow public access to the function so Box can call it. Find your function in the GCP cloud functions dashboard. Under the permissions tab, grant access to `allUsers` with the `Cloud Functions Invoker` role. 

Now, if you upload an audio file under 100MB, you should see a transcript and keyword information attached via a skills card, as well as logs under the logs tab in the function.

Note - This service uses the [synchronous method](https://cloud.ibm.com/docs/speech-to-text?topic=speech-to-text-http#HTTP-basic) provided by IBM. This method is restricted to audio 100mb and under. If you wish to use larger audio files, check out their [asynchronous](https://cloud.ibm.com/docs/speech-to-text?topic=speech-to-text-async) job model instead. 
