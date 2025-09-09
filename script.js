// Global variables
let isRecording = false;
let recognition = null;
let currentMode = 'general';
let translationHistory = [];

// Pronunciation scoring variables
window.currentPronunciationMode = false;
window.currentPronunciationTarget = '';
let pronunciationHistory = [];

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
    loadPronunciationFromStorage();
    updateSampleSentences();
    setupPronunciationEventListeners();
});

function initializeApp() {
    // Detect browser and show appropriate message
    const userAgent = navigator.userAgent.toLowerCase();
    const isFirefox = userAgent.includes('firefox');
    const isEdge = userAgent.includes('edg');
    const isChrome = userAgent.includes('chrome') && !isEdge;
    const isSafari = userAgent.includes('safari') && !isChrome && !isEdge;

    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        if (isFirefox) {
            showStatus('🦊 Firefox는 음성 인식을 지원하지 않습니다. 아래 안내를 확인해주세요.', 'warning');
            // Show Firefox notice
            document.getElementById('firefox-notice').style.display = 'block';
        } else {
            showStatus('❌ 이 브라우저는 음성 인식을 지원하지 않습니다. Chrome, Edge, Safari를 사용해주세요.', 'error');
        }
    } else {
        // Show browser-specific welcome message
        setTimeout(() => {
            if (isEdge) {
                showStatus('🎤 Edge: 마이크 버튼 클릭 → 권한 허용 → 음성 입력 (처음 사용시 설정 필요)', 'info');
            } else if (isChrome) {
                showStatus('🎤 Chrome: 마이크 버튼을 눌러 음성으로 번역해보세요!', 'info');
            } else if (isSafari) {
                showStatus('🎤 Safari: 마이크 버튼을 눌러 음성으로 번역해보세요!', 'info');
            } else {
                showStatus('🎤 마이크 버튼을 눌러 음성으로 번역해보세요!', 'info');
            }
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
    // Universal browser compatibility check
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        showStatus('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome, Edge, Safari를 사용해주세요.', 'error');
        return false;
    }

    try {
        recognition = new SpeechRecognition();
        
        // Universal settings that work across all browsers
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        // Event handlers with universal compatibility
        recognition.onstart = function() {
            console.log('Speech recognition started');
            isRecording = true;
        };

        recognition.onresult = function(event) {
            try {
                if (event.results && event.results.length > 0 && event.results[0].length > 0) {
                    const result = event.results[0][0].transcript;
                    const confidence = event.results[0][0].confidence || 0.8; // Default confidence if not provided
                    
                    if (recognition.targetElement) {
                        recognition.targetElement.value = result;
                        if (recognition.targetElement.id === 'source-text') {
                            document.getElementById('translate-btn').disabled = false;
                        }
                    }
                    
                    // Handle pronunciation mode
                    if (recognition.pronunciationMode && recognition.pronunciationTarget) {
                        handlePronunciationResult(result, confidence, recognition.pronunciationTarget);
                    } else {
                        showStatus('✅ 음성 인식 완료: ' + result, 'success');
                    }
                }
            } catch (error) {
                console.error('Result processing error:', error);
                showStatus('음성 처리 중 오류가 발생했습니다.', 'error');
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            let errorMessage = '';
            
            switch(event.error) {
                case 'not-allowed':
                case 'permission-denied':
                    errorMessage = '❌ 마이크 권한이 거부되었습니다. 주소창 옆 🔒 아이콘을 클릭하여 마이크를 허용해주세요.';
                    break;
                case 'no-speech':
                    errorMessage = '🔇 음성이 감지되지 않았습니다. 다시 시도해주세요.';
                    break;
                case 'audio-capture':
                    errorMessage = '🎤 마이크에 접근할 수 없습니다. 다른 앱에서 마이크를 사용 중인지 확인해주세요.';
                    break;
                case 'network':
                    errorMessage = '🌐 네트워크 오류가 발생했습니다.';
                    break;
                case 'service-not-allowed':
                    errorMessage = '🚫 음성 인식 서비스가 차단되었습니다.';
                    break;
                case 'bad-grammar':
                case 'language-not-supported':
                    errorMessage = '🔤 선택한 언어가 지원되지 않습니다.';
                    break;
                default:
                    errorMessage = '❌ 음성 인식 오류: ' + event.error;
            }
            
            showStatus(errorMessage, 'error');
            stopRecording();
        };

        recognition.onend = function() {
            console.log('Speech recognition ended');
            stopRecording();
        };

        return true;
    } catch (error) {
        console.error('Failed to initialize speech recognition:', error);
        showStatus('음성 인식을 초기화할 수 없습니다.', 'error');
        return false;
    }
}

function toggleRecording(type) {
    const button = document.getElementById(`mic-btn-${type}`);
    const textArea = document.getElementById(`${type}-text`);

    // Stop recording if already recording
    if (isRecording) {
        try {
            recognition.stop();
        } catch (error) {
            console.error('Error stopping recognition:', error);
            stopRecording();
        }
        return;
    }

    // Check if recognition is available
    if (!recognition) {
        const initialized = initializeSpeechRecognition();
        if (!initialized) {
            showStatus('❌ 음성 인식을 사용할 수 없습니다.', 'error');
            return;
        }
    }

    // Start recording
    startRecording(type, button, textArea);
}

function startRecording(type, button, textArea) {
    const sourceLang = document.getElementById('source-lang').value;
    const targetLang = document.getElementById('target-lang').value;
    const lang = type === 'source' ? sourceLang : targetLang;
    
    try {
        // Set language and target element
        recognition.lang = languageCodes[lang].speech;
        recognition.targetElement = textArea;
        recognition.pronunciationMode = window.currentPronunciationMode || false;
        recognition.pronunciationTarget = window.currentPronunciationTarget || '';
        
        // Add visual feedback
        button.classList.add('recording');
        
        if (recognition.pronunciationMode) {
            showStatus(`🎯 발음 연습 모드: "${recognition.pronunciationTarget}" 따라 말해보세요!`, 'info');
        } else {
            showStatus(`🎤 ${languageCodes[lang].name} 음성 인식 시작! 말씀해주세요...`, 'info');
        }
        
        // Start recognition directly - no pre-checks
        recognition.start();
        
    } catch (error) {
        console.error('Recognition start error:', error);
        handleRecognitionError(error);
        stopRecording();
    }
}


function handleRecognitionError(error) {
    if (error.name === 'InvalidStateError') {
        showStatus('⚠️ 음성 인식이 이미 실행 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
    } else if (error.name === 'NotAllowedError') {
        showStatus('❌ 마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.', 'error');
    } else if (error.name === 'ServiceNotAllowedError') {
        showStatus('🚫 음성 인식 서비스에 접근할 수 없습니다. HTTPS 연결을 확인해주세요.', 'error');
    } else {
        showStatus('❌ 음성 인식 오류: 페이지를 새로고침하고 다시 시도해주세요.', 'error');
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

// Pronunciation scoring functions
function handlePronunciationResult(spokenText, confidence, targetText) {
    const score = calculatePronunciationScore(spokenText, confidence, targetText);
    displayPronunciationScore(score, spokenText, targetText);
    savePronunciationResult(spokenText, targetText, score);
}

function calculatePronunciationScore(spokenText, confidence, targetText) {
    // Normalize texts for comparison
    const normalizedSpoken = spokenText.toLowerCase().trim();
    const normalizedTarget = targetText.toLowerCase().trim();
    
    // Base confidence score (0-100)
    let baseScore = Math.round(confidence * 100);
    
    // Text similarity bonus/penalty
    const similarity = calculateTextSimilarity(normalizedSpoken, normalizedTarget);
    let similarityBonus = similarity * 20; // Up to 20 points bonus
    
    // Word count penalty for significantly different lengths
    const spokenWords = normalizedSpoken.split(' ').length;
    const targetWords = normalizedTarget.split(' ').length;
    const lengthDifference = Math.abs(spokenWords - targetWords);
    const lengthPenalty = lengthDifference * 5; // 5 points per word difference
    
    // Calculate final score
    let finalScore = baseScore + similarityBonus - lengthPenalty;
    
    // Ensure score is between 0-100
    finalScore = Math.max(0, Math.min(100, finalScore));
    
    return {
        total: Math.round(finalScore),
        confidence: Math.round(confidence * 100),
        similarity: Math.round(similarity * 100),
        details: {
            spoken: spokenText,
            target: targetText,
            matchRate: similarity
        }
    };
}

function calculateTextSimilarity(text1, text2) {
    // Simple Levenshtein distance-based similarity
    const distance = levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j - 1][i] + 1,     // deletion
                matrix[j][i - 1] + 1,     // insertion
                matrix[j - 1][i - 1] + cost // substitution
            );
        }
    }
    
    return matrix[str2.length][str1.length];
}

function displayPronunciationScore(score, spokenText, targetText) {
    const { total, confidence, similarity } = score;
    
    let message = `🎯 발음 점수: ${total}/100\n`;
    message += `📝 말한 내용: "${spokenText}"\n`;
    message += `🎯 목표 발음: "${targetText}"\n`;
    
    let feedback = '';
    let statusType = 'success';
    
    if (total >= 90) {
        feedback = '🌟 완벽해요! 훌륭한 발음입니다!';
        statusType = 'success';
    } else if (total >= 80) {
        feedback = '👍 좋아요! 거의 완벽한 발음이에요!';
        statusType = 'success';
    } else if (total >= 70) {
        feedback = '🙂 괜찮아요! 조금 더 연습해보세요.';
        statusType = 'info';
    } else if (total >= 60) {
        feedback = '💪 연습이 필요해요. 다시 시도해보세요!';
        statusType = 'warning';
    } else {
        feedback = '📚 더 많은 연습이 필요합니다. 천천히 또박또박 말해보세요!';
        statusType = 'error';
    }
    
    showStatus(feedback, statusType);
    
    // Show detailed results in pronunciation panel
    updatePronunciationPanel(score);
}

function updatePronunciationPanel(score) {
    const panel = document.getElementById('pronunciation-results');
    if (!panel) return;
    
    const { total, confidence, similarity, details } = score;
    
    panel.innerHTML = `
        <div class="score-display">
            <div class="total-score">${total}/100</div>
            <div class="score-breakdown">
                <div class="score-item">
                    <span class="score-label">음성 신뢰도:</span>
                    <span class="score-value">${confidence}%</span>
                </div>
                <div class="score-item">
                    <span class="score-label">텍스트 일치도:</span>
                    <span class="score-value">${similarity}%</span>
                </div>
            </div>
            <div class="pronunciation-comparison">
                <div class="spoken-text">
                    <strong>말한 내용:</strong> "${details.spoken}"
                </div>
                <div class="target-text">
                    <strong>목표 발음:</strong> "${details.target}"
                </div>
            </div>
        </div>
    `;
    
    panel.style.display = 'block';
}

function savePronunciationResult(spokenText, targetText, score) {
    const result = {
        spoken: spokenText,
        target: targetText,
        score: score.total,
        confidence: score.confidence,
        similarity: score.similarity,
        timestamp: new Date().toLocaleString('ko-KR')
    };
    
    pronunciationHistory.unshift(result);
    
    // Keep only last 20 pronunciation attempts
    if (pronunciationHistory.length > 20) {
        pronunciationHistory = pronunciationHistory.slice(0, 20);
    }
    
    updatePronunciationHistory();
    savePronunciationToStorage();
}

function updatePronunciationHistory() {
    const historyContainer = document.getElementById('pronunciation-history');
    if (!historyContainer) return;
    
    historyContainer.innerHTML = '';
    
    if (pronunciationHistory.length === 0) {
        historyContainer.innerHTML = '<p style="color: #888; text-align: center;">발음 연습 기록이 없습니다.</p>';
        return;
    }
    
    pronunciationHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'pronunciation-history-item';
        
        const scoreClass = item.score >= 80 ? 'high-score' : item.score >= 60 ? 'medium-score' : 'low-score';
        
        historyItem.innerHTML = `
            <div class="history-score ${scoreClass}">${item.score}/100</div>
            <div class="history-content">
                <div class="history-spoken">말한 내용: "${item.spoken}"</div>
                <div class="history-target">목표 발음: "${item.target}"</div>
                <div class="history-time">${item.timestamp}</div>
            </div>
        `;
        
        historyContainer.appendChild(historyItem);
    });
}

function savePronunciationToStorage() {
    try {
        localStorage.setItem('pronunciationHistory', JSON.stringify(pronunciationHistory));
    } catch (error) {
        console.error('Failed to save pronunciation history:', error);
    }
}

function loadPronunciationFromStorage() {
    try {
        const saved = localStorage.getItem('pronunciationHistory');
        if (saved) {
            pronunciationHistory = JSON.parse(saved);
            updatePronunciationHistory();
        }
    } catch (error) {
        console.error('Failed to load pronunciation history:', error);
    }
}

// Pronunciation practice event listeners
function setupPronunciationEventListeners() {
    const toggleBtn = document.getElementById('toggle-pronunciation');
    const startBtn = document.getElementById('start-pronunciation');
    const clearBtn = document.getElementById('clear-pronunciation-history');
    const targetInput = document.getElementById('pronunciation-target');
    
    // Toggle pronunciation practice section
    toggleBtn.addEventListener('click', () => {
        const practiceSection = document.getElementById('pronunciation-practice');
        const isVisible = practiceSection.style.display !== 'none';
        
        if (isVisible) {
            practiceSection.style.display = 'none';
            toggleBtn.textContent = '연습 모드 켜기';
            toggleBtn.classList.remove('active');
            window.currentPronunciationMode = false;
        } else {
            practiceSection.style.display = 'block';
            toggleBtn.textContent = '연습 모드 끄기';
            toggleBtn.classList.add('active');
        }
    });
    
    // Start pronunciation practice
    startBtn.addEventListener('click', () => {
        const targetText = targetInput.value.trim();
        if (!targetText) {
            showStatus('❌ 연습할 문장을 입력해주세요.', 'error');
            return;
        }
        
        window.currentPronunciationMode = true;
        window.currentPronunciationTarget = targetText;
        
        // Hide previous results
        document.getElementById('pronunciation-results').style.display = 'none';
        
        // Start recording with pronunciation mode
        const micBtn = document.getElementById('mic-btn-source');
        const textArea = document.getElementById('source-text');
        
        // Clear the text area for pronunciation practice
        textArea.value = '';
        
        startBtn.disabled = true;
        startBtn.textContent = '연습 중...';
        
        // Auto-start recording
        toggleRecording('source');
        
        setTimeout(() => {
            startBtn.disabled = false;
            startBtn.textContent = '발음 연습 시작';
        }, 5000); // Re-enable after 5 seconds
    });
    
    // Clear pronunciation history
    clearBtn.addEventListener('click', () => {
        if (confirm('발음 연습 기록을 모두 지우시겠습니까?')) {
            pronunciationHistory = [];
            updatePronunciationHistory();
            savePronunciationToStorage();
            showStatus('발음 연습 기록이 삭제되었습니다.', 'info');
        }
    });
    
    // Add sample pronunciation targets
    const sampleTargets = [
        'Hello, how are you?',
        'Nice to meet you.',
        'What\'s your name?',
        'Where are you from?',
        'Thank you very much.',
        'Have a nice day!',
        'Could you help me?',
        'I\'m sorry, I don\'t understand.'
    ];
    
    // Add sample pronunciation buttons
    const practiceSection = document.getElementById('pronunciation-practice');
    const samplesDiv = document.createElement('div');
    samplesDiv.className = 'pronunciation-samples';
    samplesDiv.innerHTML = `
        <h5>📝 연습 예문</h5>
        <div class="sample-targets">
            ${sampleTargets.map(target => `
                <button class="sample-target-btn" data-target="${target}">
                    ${target}
                </button>
            `).join('')}
        </div>
    `;
    
    // Insert before pronunciation tips
    const tipsSection = practiceSection.querySelector('.pronunciation-tips');
    practiceSection.insertBefore(samplesDiv, tipsSection);
    
    // Add click handlers for sample targets
    practiceSection.addEventListener('click', (e) => {
        if (e.target.classList.contains('sample-target-btn')) {
            const target = e.target.dataset.target;
            targetInput.value = target;
            showStatus('🎯 연습 문장이 설정되었습니다: ' + target, 'info');
        }
    });
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