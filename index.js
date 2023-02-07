'use strict';

const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('./skills-kit-2.0');
const Box = require("box-node-sdk");
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
const { IamAuthenticator } = require('ibm-watson/auth');


exports.boxSkill = async (request, response) => {   
        const filesReader = new FilesReader(request.body);
        const skillsWriter = new SkillsWriter(filesReader.getFileContext());     
        try{
            const body = JSON.stringify(request.body);
            console.log('Request Body: ', body);

            //Validate Bpx Signature Keys So Bad People Don't Use Your Endpoint
            let isValid = Box.validateWebhookMessage(request.body, request.headers, process.env.box_primary_key, process.env.box_secondary_key);
            if(isValid){
               
                //You can use this code to save a temporary processing skills card if using the skills card option
                await skillsWriter.saveProcessingCard();

                //get the steam for the audio file
                let stream = await filesReader.getContentStream();

                //grab the file format
                let fileFormat = filesReader.getFileContext().fileFormat;

                //validate allowed file formats and size limit
                filesReader.validateFormat(process.env.skill_accepted_formats.replace(/\s/g, '').split(','));
                filesReader.validateSize(process.env.skill_file_size_limit);

                //create client for ibm stt
                const speechToText = new SpeechToTextV1({
                    authenticator: new IamAuthenticator({
                      apikey: process.env.ibm_stt_watson_key,
                    }),
                    serviceUrl: process.env.ibm_stt_watson_url,
                  });
                
                //ibm stt parameters
                const recognizeParams = {
                    audio: stream,
                    contentType: `audio/${fileFormat}`,
                    wordAlternativesThreshold: 0.9,
                    keywords: process.env.keyword_dictionary.split(','),
                    keywordsThreshold: 0.5,
                    audioMetrics: true,
                    smartFormatting: true, 
                    timestamps: true, 
                    maxAlternatives: 0,
                    profanityFilter: true
                };

                //call to process audio file
                speechToText.recognize(recognizeParams)
                .then(speechRecognitionResults => {
                    console.log('speech translated');
                    //send results to process
                    addSkillsData(speechRecognitionResults);
                })
                .catch(err => {
                    console.log('error:', err);
                });

            } else {
                console.log('Keys Were Not Valid')
                response.status(200).send('Unauthorized');
            }
        } catch (error) {
            await skillsWriter.saveErrorCard(SkillsErrorEnum.UNKNOWN,`Skill processing failed for file: ${filesReader.getFileContext().fileId} with error: ${error.message}`);
            console.error(
                `Skill processing failed for file: ${filesReader.getFileContext().fileId} with error: ${error.message}`
            );
            response.status(200).send('Something went wrong.');
        }

        async function addSkillsData (speechRecognitionResults){
            const mockListOfDiscoveredKeywordswithAppearsAtForPlaybackFiles = [];
            const mockListOfTranscriptsWithAppearsAtForPlaybackFiles = [];
            const cards = [];
            const keywordMap = new Map()

            //Get transcript for every result
            for (let i = 0; i < speechRecognitionResults["result"]["results"].length; i++) {
                let transcript = {
                    text: speechRecognitionResults["result"]["results"][i]["alternatives"][0]["transcript"],
                    appears: [{
                        start: Math.floor(speechRecognitionResults["result"]["results"][i]["alternatives"][0]["timestamps"][0][2]),
                        end: Math.ceil(speechRecognitionResults["result"]["results"][i]["alternatives"][0]["timestamps"][speechRecognitionResults["result"]["results"][i]["alternatives"][0]["timestamps"].length-1][2])
                    }]
                }
                mockListOfTranscriptsWithAppearsAtForPlaybackFiles.push(transcript);
                //find all unqiue keywords
                let keywords = Object.keys(speechRecognitionResults["result"]["results"][i]["keywords_result"])
                
                //Iterate over all keyword results
                keywords.forEach(keyword => {
                    let appearsData = speechRecognitionResults["result"]["results"][i]["keywords_result"][keyword]
                        //Insert each time stamp into a keyword results map
                        appearsData.forEach(appears => {
                            let start = Math.floor(appears["start_time"])
                            let end = Math.ceil(appears["end_time"])
                            //Checks to see if the map already contains the keyword if it does it just add a new time object to values
                            if(keywordMap.has(keyword)){
                                let newTimeData = keywordMap.get(keyword)
                                newTimeData.push({start, end})
                                keywordMap.set(keyword, newTimeData)
                            } else {
                                keywordMap.set(keyword, [{start, end}])                    
                            }
                        });
            
                });
            }
            //iterate over the map and build the skills cards
            keywordMap.forEach((timeData, keyword) => {
                let keywordData = {
                    text: keyword,
                    appears: timeData
                }
                mockListOfDiscoveredKeywordswithAppearsAtForPlaybackFiles.push(keywordData);
            })
            //Order of cards.push is how the skills cards appear in the web app
            cards.push(skillsWriter.createTranscriptsCard(mockListOfTranscriptsWithAppearsAtForPlaybackFiles, speechRecognitionResults["result"]["audio_metrics"]["accumulated"]["end_time"]));
            cards.push(skillsWriter.createTopicsCard(mockListOfDiscoveredKeywordswithAppearsAtForPlaybackFiles, speechRecognitionResults["result"]["audio_metrics"]["accumulated"]["end_time"]));
            await skillsWriter.saveDataCards(cards);

            //You can uncomment to see raw response data from IBM saved to the file as metadata.
            // await skillsWriter.fileWriteClient.files.setMetadata(
            //     skillsWriter.fileId,
            //     skillsWriter.fileWriteClient.metadata.scopes.GLOBAL,
            //     'properties',
            //     { skillMessage: JSON.stringify(speechRecognitionResults, null, 2) }
            // );

            console.log("Skill process completed.")
            // Skills engine requires a 200 response within 10 seconds of sending an event.
            response.status(200).send('Box event was processed by skill');
        }
};
