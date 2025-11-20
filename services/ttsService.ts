
export const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  
  // Cancel any currently playing audio to avoid overlap
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Get available voices
  const voices = window.speechSynthesis.getVoices();
  
  // Strategy to find the best Spanish voice:
  // 1. Exact match for Argentina
  // 2. Generic Spanish (Latin American preferred)
  // 3. Any Spanish
  const esVoice = voices.find(v => v.lang === 'es-AR') || 
                  voices.find(v => v.lang === 'es-419') || 
                  voices.find(v => v.lang === 'es-MX') || 
                  voices.find(v => v.lang.startsWith('es'));
                  
  if (esVoice) {
      utterance.voice = esVoice;
  }
  
  // Adjust generic parameters for a natural feel
  utterance.rate = 1.0; 
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
};

export const cancel = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

// Ensure voices are loaded (Chrome/Safari quirks)
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
