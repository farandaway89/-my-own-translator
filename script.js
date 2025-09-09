// Global variables
let isRecording = false;
let recognition = null;
let currentMode = 'general';
let translationHistory = [];

// Sample sentences for different modes
const sampleSentences = {
    general: [
        { ko: "안녕하세요", en: "Hello" },
        { ko: "감사합니다", en: "Thank you" },
        { ko: "죄송합니다", en: "I'm sorry" },
        { ko: "도와주세요", en: "Please help me" },
        { ko: "어디에 있나요?", en: "Where is it?" }
    ],
    travel: [
        { ko: "공항이 어디에 있나요?", en: "Where is the airport?" },
        { ko: "호텔을 찾고 있어요", en: "I'm looking for a hotel" },
        { ko: "지하철역이 어디인가요?", en: "Where is the subway station?" },
        { ko: "얼마예요?", en: "How much is it?" },
        { ko: "체크인 하고 싶어요", en: "I'd like to check in" }
    ],
    business: [
        { ko: "회의실이 어디에 있나요?", en: "Where is the meeting room?" },
        { ko: "프레젠테이션을 시작하겠습니다", en: "I'll start the presentation" },
        { ko: "계약서를 검토해주세요", en: "Please review the contract" },
        { ko: "일정을 조정할 수 있나요?", en: "Can we reschedule?" },
        { ko: "이메일을 보내드리겠습니다", en: "I'll send you an email" }
    ],
    study: [
        { ko: "수업이 몇 시에 시작하나요?", en: "What time does the class start?" },
        { ko: "과제를 제출해야 해요", en: "I need to submit the assignment" },
        { ko: "교수님께 질문이 있어요", en: "I have a question for the professor" },
        { ko: "도서관이 어디에 있나요?", en: "Where is the library?" },
        { ko: "시험 일정을 알려주세요", en: "Please tell me the exam schedule" }
    ]
};

// Language codes for speech recognition and synthesis
const languageCodes = {
    ko: { speech: 'ko-KR', name: '한국어' },
    en: { speech: 'en-US', name: 'English' },
    ja: { speech: 'ja-JP', name: '日本語' },
    zh: { speech: 'zh-CN', name: '中文' }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadTranslationHistory();
    updateSampleSentences();
});

function initializeApp() {
    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showStatus('음성 인식이 지원되지 않습니다. Chrome, Edge, Safari 브라우저를 사용해주세요.', 'error');
    } else {
        // Show welcome message with instructions
        setTimeout(() => {
            showStatus('🎤 마이크 버튼을 눌러 음성으로 번역해보세요! (마이크 권한 허용 필요)', 'info');
        }, 1000);
    }

    // Event listeners
    setupEventListeners();
    
    // Initialize speech recognition
    initializeSpeechRecognition();
}

function setupEventListeners() {
    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            updateSampleSentences();
        });
    });

    // Translation button
    document.getElementById('translate-btn').addEventListener('click', translateText);

    // Microphone buttons
    document.getElementById('mic-btn-source').addEventListener('click', () => toggleRecording('source'));
    document.getElementById('mic-btn-target').addEventListener('click', () => toggleRecording('target'));

    // Speak buttons
    document.getElementById('speak-btn-target').addEventListener('click', () => speakText('target'));

    // Swap languages button
    document.getElementById('swap-btn').addEventListener('click', swapLanguages);

    // Clear history button
    document.getElementById('clear-history').addEventListener('click', clearHistory);

    // Text input events
    document.getElementById('source-text').addEventListener('input', function() {
        if (this.value.trim()) {
            document.getElementById('translate-btn').disabled = false;
        } else {
            document.getElementById('translate-btn').disabled = true;
        }
    });

    // Enter key for translation
    document.getElementById('source-text').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.value.trim()) {
                translateText();
            }
        }
    });
}

function initializeSpeechRecognition() {
    // Check for HTTPS requirement
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('Speech recognition requires HTTPS');
        showStatus('음성 인식은 HTTPS가 필요합니다.', 'warning');
    }

    // Initialize speech recognition with better browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        showStatus('이 브라우저는 음성 인식을 지원하지 않습니다.', 'error');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
        console.log('Speech recognition started');
        showStatus('음성 인식이 시작되었습니다. 말씀해주세요.', 'info');
    };

    recognition.onresult = function(event) {
        if (event.results && event.results.length > 0) {
            const result = event.results[0][0].transcript;
            if (recognition.targetElement) {
                recognition.targetElement.value = result;
                if (recognition.targetElement.id === 'source-text') {
                    document.getElementById('translate-btn').disabled = false;
                }
            }
            showStatus('음성 인식 완료: ' + result, 'success');
        }
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        let errorMessage = '음성 인식 오류';
        
        switch(event.error) {
            case 'not-allowed':
                errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
                break;
            case 'no-speech':
                errorMessage = '음성이 감지되지 않았습니다. 다시 시도해주세요.';
                break;
            case 'network':
                errorMessage = '네트워크 오류가 발생했습니다.';
                break;
            case 'service-not-allowed':
                errorMessage = '음성 인식 서비스가 차단되었습니다. HTTPS 연결이 필요할 수 있습니다.';
                break;
            default:
                errorMessage = '음성 인식 오류: ' + event.error;
        }
        
        showStatus(errorMessage, 'error');
        stopRecording();
    };

    recognition.onend = function() {
        console.log('Speech recognition ended');
        stopRecording();
    };

    // Request microphone permission proactively
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                console.log('Microphone permission granted');
                stream.getTracks().forEach(track => track.stop()); // Stop the stream
            })
            .catch(function(err) {
                console.warn('Microphone permission denied:', err);
                showStatus('마이크 권한이 필요합니다. 브라우저에서 권한을 허용해주세요.', 'warning');
            });
    }
}

function toggleRecording(type) {
    const button = document.getElementById(`mic-btn-${type}`);
    const textArea = document.getElementById(`${type}-text`);

    if (!recognition) {
        showStatus('음성 인식이 지원되지 않습니다. Chrome, Edge, Safari를 사용해보세요.', 'error');
        return;
    }

    if (isRecording) {
        recognition.stop();
        return;
    }

    // Check microphone permission first
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'microphone' }).then(function(result) {
            if (result.state === 'denied') {
                showStatus('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.', 'error');
                return;
            }
            startRecording(type, button, textArea);
        }).catch(function() {
            // Fallback if permissions API is not supported
            startRecording(type, button, textArea);
        });
    } else {
        startRecording(type, button, textArea);
    }
}

function startRecording(type, button, textArea) {
    const sourceLang = document.getElementById('source-lang').value;
    const targetLang = document.getElementById('target-lang').value;
    const lang = type === 'source' ? sourceLang : targetLang;
    
    recognition.lang = languageCodes[lang].speech;
    recognition.targetElement = textArea;
    
    try {
        recognition.start();
        button.classList.add('recording');
        isRecording = true;
        showStatus(`🎤 ${languageCodes[lang].name} 음성 인식 중... (말씀해주세요)`, 'info');
    } catch (error) {
        console.error('Recognition start error:', error);
        if (error.name === 'InvalidStateError') {
            showStatus('음성 인식이 이미 실행 중입니다. 잠시 후 다시 시도해주세요.', 'error');
        } else {
            showStatus('음성 인식을 시작할 수 없습니다: ' + error.message, 'error');
        }
        stopRecording();
    }
}

function stopRecording() {
    isRecording = false;
    document.querySelectorAll('.mic-btn').forEach(btn => {
        btn.classList.remove('recording');
    });
}

async function translateText() {
    const sourceText = document.getElementById('source-text').value.trim();
    const sourceLang = document.getElementById('source-lang').value;
    const targetLang = document.getElementById('target-lang').value;

    if (!sourceText) {
        showStatus('번역할 텍스트를 입력해주세요.', 'error');
        return;
    }

    if (sourceLang === targetLang) {
        showStatus('원본 언어와 번역 언어가 같습니다.', 'error');
        return;
    }

    showLoading(true);
    
    try {
        // Using MyMemory Translation API (free)
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(sourceText)}&langpair=${sourceLang}|${targetLang}`);
        const data = await response.json();
        
        if (data.responseStatus === 200 || data.responseData) {
            const translatedText = data.responseData.translatedText;
            document.getElementById('target-text').value = translatedText;
            
            // Add to history
            addToHistory(sourceText, translatedText, sourceLang, targetLang);
            
            showStatus('번역 완료!', 'success');
        } else {
            throw new Error('Translation failed');
        }
    } catch (error) {
        console.error('Translation error:', error);
        // Fallback: Simple word substitution for demo
        const translatedText = await fallbackTranslation(sourceText, sourceLang, targetLang);
        document.getElementById('target-text').value = translatedText;
        addToHistory(sourceText, translatedText, sourceLang, targetLang);
        showStatus('번역 완료 (오프라인 모드)', 'info');
    }
    
    showLoading(false);
}

async function fallbackTranslation(text, fromLang, toLang) {
    // Simple fallback translation for common phrases
    const commonTranslations = {
        'ko-en': {
            '안녕하세요': 'Hello',
            '감사합니다': 'Thank you',
            '죄송합니다': 'I\'m sorry',
            '도와주세요': 'Please help me',
            '안녕히 가세요': 'Goodbye',
            '어디에 있나요?': 'Where is it?',
            '얼마예요?': 'How much is it?',
            '네': 'Yes',
            '아니요': 'No'
        },
        'en-ko': {
            'hello': '안녕하세요',
            'thank you': '감사합니다',
            'sorry': '죄송합니다',
            'help': '도움',
            'goodbye': '안녕히 가세요',
            'where': '어디',
            'how much': '얼마',
            'yes': '네',
            'no': '아니요'
        }
    };

    const key = `${fromLang}-${toLang}`;
    const translations = commonTranslations[key];
    
    if (translations) {
        const lowerText = text.toLowerCase();
        for (const [original, translated] of Object.entries(translations)) {
            if (lowerText.includes(original.toLowerCase())) {
                return translated;
            }
        }
    }
    
    return `[번역: ${text}]`;
}

function speakText(type) {
    const textArea = document.getElementById(`${type}-text`);
    const text = textArea.value.trim();
    
    if (!text) {
        showStatus('읽을 텍스트가 없습니다.', 'error');
        return;
    }

    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        const lang = type === 'source' ? 
            document.getElementById('source-lang').value : 
            document.getElementById('target-lang').value;
        
        utterance.lang = languageCodes[lang].speech;
        utterance.rate = 0.8;
        utterance.pitch = 1;
        
        speechSynthesis.speak(utterance);
        showStatus('음성 재생 중...', 'info');
    } else {
        showStatus('음성 합성이 지원되지 않습니다.', 'error');
    }
}

function swapLanguages() {
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');

    // Swap language selectors
    const tempLang = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = tempLang;

    // Swap text contents
    const tempText = sourceText.value;
    sourceText.value = targetText.value;
    targetText.value = tempText;

    showStatus('언어가 바뀌었습니다.', 'info');
}

function addToHistory(sourceText, targetText, sourceLang, targetLang) {
    const historyItem = {
        source: sourceText,
        target: targetText,
        sourceLang: sourceLang,
        targetLang: targetLang,
        timestamp: new Date().toLocaleString('ko-KR')
    };

    translationHistory.unshift(historyItem);
    
    // Keep only last 10 items
    if (translationHistory.length > 10) {
        translationHistory = translationHistory.slice(0, 10);
    }

    updateHistoryDisplay();
    saveTranslationHistory();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';

    if (translationHistory.length === 0) {
        historyList.innerHTML = '<p style="color: #888; text-align: center;">번역 기록이 없습니다.</p>';
        return;
    }

    translationHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-source">${languageCodes[item.sourceLang].name}: ${item.source}</div>
            <div class="history-target">${languageCodes[item.targetLang].name}: ${item.target}</div>
            <div class="history-time">${item.timestamp}</div>
        `;
        
        historyItem.addEventListener('click', () => {
            document.getElementById('source-text').value = item.source;
            document.getElementById('target-text').value = item.target;
            document.getElementById('source-lang').value = item.sourceLang;
            document.getElementById('target-lang').value = item.targetLang;
            showStatus('기록에서 복원되었습니다.', 'info');
        });
        
        historyList.appendChild(historyItem);
    });
}

function clearHistory() {
    if (confirm('번역 기록을 모두 지우시겠습니까?')) {
        translationHistory = [];
        updateHistoryDisplay();
        saveTranslationHistory();
        showStatus('번역 기록이 삭제되었습니다.', 'info');
    }
}

function saveTranslationHistory() {
    try {
        localStorage.setItem('translationHistory', JSON.stringify(translationHistory));
    } catch (error) {
        console.error('Failed to save history:', error);
    }
}

function loadTranslationHistory() {
    try {
        const saved = localStorage.getItem('translationHistory');
        if (saved) {
            translationHistory = JSON.parse(saved);
            updateHistoryDisplay();
        }
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

function updateSampleSentences() {
    const sampleList = document.getElementById('sample-list');
    const sentences = sampleSentences[currentMode] || [];
    
    sampleList.innerHTML = '';
    
    sentences.forEach(sentence => {
        const sampleItem = document.createElement('div');
        sampleItem.className = 'sample-item';
        sampleItem.innerHTML = `<strong>${sentence.ko}</strong> → ${sentence.en}`;
        
        sampleItem.addEventListener('click', () => {
            document.getElementById('source-text').value = sentence.ko;
            document.getElementById('source-lang').value = 'ko';
            document.getElementById('target-lang').value = 'en';
            document.getElementById('translate-btn').disabled = false;
            showStatus('예문이 입력되었습니다.', 'info');
        });
        
        sampleList.appendChild(sampleItem);
    });
}

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('active');
}

function showStatus(message, type) {
    const statusDisplay = document.getElementById('status-display');
    statusDisplay.textContent = message;
    statusDisplay.className = `status-display ${type}`;
    
    // Show status longer for errors and warnings
    const timeout = (type === 'error' || type === 'warning') ? 5000 : 3000;
    
    setTimeout(() => {
        statusDisplay.textContent = '';
        statusDisplay.className = 'status-display';
    }, timeout);
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

// Close settings panel when clicking outside
document.addEventListener('click', function(event) {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBtn = document.querySelector('.settings-btn');
    
    if (!settingsPanel.contains(event.target) && !settingsBtn.contains(event.target)) {
        settingsPanel.classList.remove('active');
    }
});

// Prevent form submission on enter
document.addEventListener('keypress', function(e) {
    if (e.target.tagName !== 'TEXTAREA' && e.key === 'Enter') {
        e.preventDefault();
    }
});