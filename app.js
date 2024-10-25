let recognizer; // 在全局作用域声明

// 定义 JSON 文件路径
const jsonPath = '/azure_speech_service_parameters.json'; 
const openai_jsonPath = '/openai_parameters.json'; 

const deploymentName = 'gpt-4o-mini'; 

let recognizerStartTime; 
let recognitionResultTime; 
let translationRequestTime; 
let translationResultTime; 

// 定義翻譯函數
async function translateText(text, sourceLanguage) {
    const targetLanguage = sourceLanguage === 'en-US' ? 'zh-TW' : 'en';

    const messages = [
        {
            role: "system",
            content: `You are a translator. Your task is to strictly translate the user's input from ${sourceLanguage === 'en-US' ? 'English' : 'Chinese'} to ${targetLanguage === 'zh-TW' ? 'Chinese' : 'English'}. Do not add any additional comments or information.`
        },
        {
            role: "user",
            content: text
        }
    ];

    // 記錄翻譯請求發送時間
    translationRequestTime = new Date().getTime();

    const response = await fetch(`${azureEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${azureVersion}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': azureApiKey, // 使用加載的 Azure API 金鑰
        },
        body: JSON.stringify({
            messages: messages,
            max_tokens: 100,
            temperature: 0.5,
        }),
    });

    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }

    // 記錄翻譯結果返回時間
    translationResultTime = new Date().getTime();

    // 計算 recognitionTime 和 translationTime
    const recognitionTime = (recognitionResultTime - recognizerStartTime) / 1000;
    const translationTime = (translationResultTime - translationRequestTime) / 1000;
    const totalDelay = recognitionTime + translationTime;

    console.log(`Translation time: ${translationTime} seconds`);

    // 更新頁面上的時間顯示
    // document.getElementById("recognitionTime").innerText = `Recognition time: ${recognitionTime} seconds`;

    document.getElementById("translationTime").innerText = `Translation time: ${translationTime} seconds`;

    const data = await response.json();
    return data.choices[0].message.content.trim();
}


// // 定義潤飾函數
// async function enhanceTextWithGPT(text) {
//     const prompt = `請幫我潤飾並修正以下的文本，修正錯字和語法錯誤：
    
//     "${text}"`;

//     const response = await fetch(`${azureEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-04-01-preview`, {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//             'api-key': azureApiKey, 
//         },
//         body: JSON.stringify({
//             messages: [{ role: "user", content: prompt }],
//             max_tokens: 1000,
//             temperature: 0.7,
//         }),
//     });

//     if (!response.ok) {
//         throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
//     }

//     const data = await response.json();
//     return data.choices[0].message.content.trim();
// }

// 定義添加自訂短語的函數
function addCustomPhrases(recognizer, customPhrases) {
    const phraseListGrammar = SpeechSDK.PhraseListGrammar.fromRecognizer(recognizer);
    
    customPhrases.forEach(phrase => {
        phraseListGrammar.addPhrase(phrase);
    });
}

// 初始化识别器的事件
function initializeRecognizer() {
    // 自訂短語列表
    const customPhrases = ["TECO"];
    // 添加自訂短語
    addCustomPhrases(recognizer, customPhrases);

    recognizer.recognizing = async (s, e) => {
        if (e && e.result && e.result.text) {
            const intermediateTranslation = await translateText(e.result.text);
            document.getElementById("recognizedText").innerText = `Intermediate: ${e.result.text}\nIntermediate Translation: ${intermediateTranslation}`;
            console.log(`識别中的结果: ${e.result.text}\n識别中的翻譯结果: ${intermediateTranslation}`);
        }
    };

    recognizer.recognized = async (s, e) => {
        if (e && e.result && e.result.text) {
            // 記錄識別結果的時間
            recognitionResultTime = new Date().getTime();

            // 計算識別所花的時間
            const recognitionTime = (recognitionResultTime - recognizerStartTime) / 1000;
            console.log(`Recognition time: ${recognitionTime} seconds`);

            const detectedLanguage = e.result.language;
            console.log(`Recognized (${detectedLanguage}): ${e.result.text}`);

            // 呼叫GPT模型進行潤飾
            // const enhancedText = await enhanceTextWithGPT(e.result.text);
            document.getElementById("originalText").innerText = `Sound text: ${e.result.text}`;

            // 呼叫翻譯函數
            const translatedText = await translateText(e.result.text, detectedLanguage);

            // 更新頁面內容，顯示翻譯後的文本
            document.getElementById("recognizedText").innerText = `Translated text: ${translatedText}`;
        } else {
            console.log("Recognition result is undefined.");
        }
    };
}

function startRecognition() {
    if (recognizer) {
        document.getElementById("startButton").disabled = true;
        document.getElementById("startButton").style.backgroundColor = "#d3d3d3"; 

        recognizerStartTime = new Date().getTime(); // 初始化识别开始时间
        recognizer.startContinuousRecognitionAsync();
    } else {
        console.warn("Recognizer is not initialized.");
    }
}

function stopRecognition() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
            () => { 
                console.log("Recognition stopped."); 
                document.getElementById("startButton").disabled = false;
                document.getElementById("startButton").style.backgroundColor = ""; 
            },
            (err) => { 
                console.error("Failed to stop recognition: " + err); 
            }
        );
    } else {
        console.warn("Recognizer is not initialized or already stopped.");
    }
}

// 在加載 OpenAI JSON 配置後初始化 API 金鑰和端點
fetch(openai_jsonPath)
    .then(response => response.json())
    .then(openaiParams => {
        azureApiKey = openaiParams['OPENAI_API_KEY']; // 從 JSON 中獲取 API 金鑰
        azureEndpoint = openaiParams['OPENAI_API_BASE']; // 從 JSON 中獲取端點
        azureVersion = openaiParams['OPENAI_API_VERSION']; // 從 JSON 中獲取 API 版本

        // 加載 Azure Speech Service 配置並初始化 recognizer
        return fetch(jsonPath);
    })
    .then(response => response.json())
    .then(sttParams => {
        const speechKey = sttParams['YOUR_SPEECH_KEY']; 
        const serviceRegion = sttParams['YOUR_SERVICE_REGION']; 

        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, serviceRegion);
        speechConfig.speechRecognitionLanguage = "zh-TW"; 

        const autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(["en-US", "zh-TW"]);
        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

        // 初始化識別器並設置為全域變數
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig, autoDetectSourceLanguageConfig);

        // 初始化識別器事件
        initializeRecognizer();

        // 將這些函數綁定到全域變數（假設你需要在其他地方調用）
        window.startRecognition = startRecognition;
        window.stopRecognition = stopRecognition;
    })
    .catch(error => console.error('Error loading JSON:', error));
