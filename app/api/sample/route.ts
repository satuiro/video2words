import { OpenAI } from "openai";
import { exec } from "child_process";
import ytdl from "ytdl-core";
import fs from 'fs';
import { NextResponse } from "next/server";
// Promisify the exec function from child_process
const util = require('util');
const execAsync = util.promisify(exec);

const youtubeUrl = 'https://www.youtube.com/watch?v=QOczdBlT2v4';

const openai = new OpenAI.OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export async function GET(request: Request) {
    try {
        const finalRes = await getTranscribeText();
        
        if (finalRes) fs.unlinkSync('./temp/output.mp3')

        console.log('The final response is ', finalRes);
        
        return new NextResponse(finalRes)
    } catch (error) {
        if (error instanceof Error) {
            console.log('Error in transcribing the audio ', error.message);
            return NextResponse.json({error: error.message}, {status: 501});
        }
    }
}

const downloadAudio = async (url: string, outputFilePath: any) => {
    const videoInfo = await ytdl.getInfo(url);
    const audioFormat = ytdl.chooseFormat(videoInfo.formats, { quality: 'highestaudio' });
  
    if (!audioFormat) {
      throw new Error('No audio format found');
    }
  
    const audioStream = ytdl(url, { format: audioFormat });
    const outputStream = fs.createWriteStream(outputFilePath);
  
    audioStream.pipe(outputStream);
  
    return new Promise((resolve, reject) => {
      audioStream.on('end', () => {
        // @ts-ignore
        resolve();
      });
  
      audioStream.on('error', (err) => {
        reject(err);
      });
    });
};

async function convertToMp3(inputFilePath: string) {
    await downloadAudio(youtubeUrl, './temp/temp.mp4');
    console.log('Audio downloaded successfully');

    const outputFilePath = './temp/output.mp3'
    await execAsync(`ffmpeg -i ${inputFilePath} ${outputFilePath}`)

    // Read the audio data 
    const mp3AudioData = fs.readFileSync('./temp/output.mp3')
    fs.unlinkSync(inputFilePath);
    fs.unlinkSync(outputFilePath);

    return mp3AudioData;
}

async function getTranscribeText() {
    const mp3AudioData = await convertToMp3('./temp/temp.mp4')
    // Write the MP3 audio data to a file
    const outputPath = './temp/output.mp3';
    fs.writeFileSync(outputPath, mp3AudioData);
    console.log('Starting transcription');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(outputPath),
      model: "whisper-1",
    });
  
    return transcription.text
}