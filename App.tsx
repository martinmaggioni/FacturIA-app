import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, InvoiceData } from './types';
import { parseInvoiceRequest } from './services/geminiService';
import { speak, cancel } from './services/ttsService';
import VoiceInput from './components/VoiceInput';
import InvoiceReview from './components/InvoiceReview';
import { LogOut, CheckCircle, Clock, Volume2, VolumeX, AlertTriangle, BrainCircuit, Settings, Key, FileKey, Server, Upload, Download, FileJson, Info, Wifi, WifiOff, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  // --- Configuración Persistente ---
  const [serverUrl, setServerUrl] = useState('http://localhost:3001');
  const [cuit, setCuit] = useState('');
  const [cert, setCert] = useState('');
  const [key, setKey] = useState('');
  
  // --- Estado de la App ---
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showSettings, setShowSettings] = useState(false); // Mostrar pantalla de configuración
  
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Cargar Configuración al Inicio ---
  useEffect(() => {
    const savedUrl = localStorage.getItem('facturia_server_url');
    const savedCuit = localStorage.getItem('facturia_cuit');
    const savedCert = localStorage.getItem('facturia_cert');
    const savedKey = localStorage.getItem('facturia_key');

    if (savedUrl) setServerUrl(savedUrl);
    if (savedCuit) setCuit(savedCuit);
    if (savedCert) setCert(savedCert);
    if (savedKey) setKey(savedKey);
  }, []);

  // --- Helpers ---
  
  const playAudio = (text: string) => {
    if (audioEnabled) {
      speak(text);
    }
  };

  const toggleAudio = () => {
    if (audioEnabled) {
      // Si estaba activado y lo vamos a desactivar, callar inmediatamente
      cancel();
    }
    setAudioEnabled(!audioEnabled);
  };

  const saveSettings = () => {
    // Limpiar espacios en blanco comunes al copiar/pegar certificados
    const cleanCert = cert.trim();
    const cleanKey = key.trim();
    
    setCert(cleanCert);
    setKey(cleanKey);

    localStorage.setItem('facturia_server_url', serverUrl);
    localStorage.setItem('facturia_cuit', cuit);
    localStorage.setItem('facturia_cert', cleanCert);
    localStorage.setItem('facturia_key', cleanKey);
    setShowSettings(false);
    playAudio("Configuración guardada.");
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('unknown');
    try {
        const res = await fetch(`${serverUrl}/`, { method: 'GET' });
        if (res.ok) {
            setConnectionStatus('success');
            playAudio("Conexión exitosa con el servidor.");
        } else {
            throw new Error("Server error");
        }
    } catch (error) {
        setConnectionStatus('error');
        playAudio("No se pudo conectar al servidor.");
    } finally {
        setIsTestingConnection(false);
    }
  };

  const handleExportProfile = () => {
    const profileData = {
      serverUrl,
      cuit,
      cert,
      key
    };
    const dataStr = JSON.stringify(profileData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `facturia_perfil_${cuit || 'sin_cuit'}.json`;
    link.href = url;
    link.click();
    playAudio("Perfil exportado.");
  };

  const handleImportProfile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (parsed.serverUrl) setServerUrl(parsed.serverUrl);
        if (parsed.cuit) setCuit(parsed.cuit);
        if (parsed.cert) setCert(parsed.cert);
        if (parsed.key) setKey(parsed.key);
        
        playAudio("Perfil importado correctamente.");
      } catch (error) {
        setErrorMessage("Error al leer el archivo.");
        playAudio("Archivo inválido.");
      }
    };
    reader.readAsText(file);
  };

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (cuit && cert && key) {
      const userData: UserProfile = {
        cuit,
        cert,
        key,
        companyName: `CUIT: ${cuit}`,
        isLoggedIn: true
      };
      setUser(userData);
      
      setTimeout(() => {
        playAudio(`Bienvenido.`);
      }, 500);
    } else {
        setShowSettings(true);
        playAudio("Configura tus datos primero.");
    }
  };

  const processRequest = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const data = await parseInvoiceRequest(text);
      const completeData: InvoiceData = {
        posNumber: 1, // Default POS, can be changed in review
        ...data
      };
      setInvoiceDraft(completeData);
      playAudio("Borrador generado.");
    } catch (error) {
      const errorMsg = "No entendí la solicitud. Intenta de nuevo.";
      setErrorMessage(errorMsg);
      playAudio(errorMsg);
    } finally {
      setIsProcessing(false);
      setInputText('');
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setInputText(text);
    processRequest(text);
  };

  const handleFinalSubmit = async () => {
    if (!invoiceDraft || !user) return;
    setIsProcessing(true);
    setErrorMessage(null);
    
    try {
        const payload = {
            auth: {
                cuit: user.cuit,
                cert: user.cert,
                key: user.key
            },
            invoice: invoiceDraft
        };

        const response = await fetch(`${serverUrl}/api/create-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let errText = response.statusText;
            try {
                const errJson = await response.json();
                errText = errJson.message || errText;
            } catch(e) {}
            throw new Error(errText);
        }

        const result = await response.json();

        if (result.success) {
             let msg = `¡Éxito! CAE: ${result.cae}`;
             setSuccessMessage(msg);
             playAudio("Comprobante autorizado.");
             setInvoiceDraft(null);
             setTimeout(() => setSuccessMessage(null), 8000);
        } else {
            throw new Error(result.message || "Error desconocido");
        }

    } catch (error: any) {
        console.error(error);
        const msg = `Error: ${error.message}`;
        setErrorMessage(msg);
        playAudio("Hubo un error al enviar el comprobante.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- RENDER: PANTALLA DE CONFIGURACIÓN ---
  if (showSettings) {
      return (
        <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center fixed inset-0 z-50">
            <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 animate-fade-in-up max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Settings className="w-6 h-6" /> Configuración
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-black font-medium">Cerrar</button>
                </div>

                <div className="overflow-y-auto pr-2 flex-grow space-y-5">
                    {/* Export/Import Tools */}
                    <div className="flex gap-2">
                       <button 
                         onClick={handleExportProfile}
                         className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold"
                       >
                          <Download className="w-4 h-4" /> Exportar
                       </button>
                       <button 
                         onClick={() => fileInputRef.current?.click()}
                         className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold"
                       >
                          <Upload className="w-4 h-4" /> Importar
                       </button>
                       <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".json" 
                            onChange={handleImportProfile}
                       />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">URL del Servidor</label>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:ring-2 focus-within:ring-black">
                            <Server className="w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-sm"
                                placeholder="https://..."
                            />
                        </div>
                        
                        {/* Botón Probar Conexión Nuevo */}
                        <button 
                            onClick={testConnection}
                            disabled={isTestingConnection}
                            className={`mt-2 w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                                connectionStatus === 'success' ? 'bg-green-100 text-green-700' :
                                connectionStatus === 'error' ? 'bg-red-100 text-red-700' :
                                'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                        >
                            {isTestingConnection ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : connectionStatus === 'success' ? (
                                <Wifi className="w-3 h-3" />
                            ) : (
                                <WifiOff className="w-3 h-3" />
                            )}
                            {isTestingConnection ? 'Conectando...' : 
                             connectionStatus === 'success' ? 'Conexión Exitosa' : 
                             connectionStatus === 'error' ? 'Falló la conexión (Reintentar)' : 
                             'Probar Conexión'}
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">CUIT Emisor</label>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                            <Key className="w-5 h-5 text-gray-400" />
                            <input 
                                type="number" 
                                value={cuit}
                                onChange={(e) => setCuit(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-sm"
                                placeholder="20123456789"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Certificado (.crt)</label>
                        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                            <textarea 
                                value={cert}
                                onChange={(e) => setCert(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-xs font-mono h-20 resize-none"
                                placeholder="Copiar contenido de .crt"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Clave Privada (.key)</label>
                        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                            <textarea 
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-xs font-mono h-20 resize-none"
                                placeholder="Copiar contenido de .key"
                            />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={saveSettings}
                    className="w-full mt-4 bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-all"
                >
                    Guardar Cambios
                </button>
            </div>
        </div>
      );
  }

  // --- RENDER: LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 relative">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md z-10">
          <div className="flex justify-center mb-6">
             <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-gray-300">
                <BrainCircuit className="text-white w-8 h-8" />
             </div>
          </div>
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-1">FacturIA</h1>
          
          <form onSubmit={handleLogin} className="space-y-4 mt-6">
            {cuit ? (
                <>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Cuenta</p>
                        <p className="text-xl font-bold text-gray-800">{cuit}</p>
                    </div>
                    
                    <button 
                      type="submit"
                      className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 shadow-lg mt-2"
                    >
                      Ingresar
                    </button>

                     <button 
                      type="button"
                      onClick={() => setShowSettings(true)}
                      className="w-full bg-white text-gray-600 font-medium py-2 rounded-xl hover:bg-gray-50 border border-gray-200 mt-2"
                    >
                      Modificar Datos
                    </button>
                </>
            ) : (
                <>
                    <button 
                      type="button"
                      onClick={() => setShowSettings(true)}
                      className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 shadow-lg"
                    >
                      Comenzar Configuración
                    </button>
                </>
            )}
            
            <p className="text-center text-gray-400 text-xs mt-6 font-medium">Desarrollado por Martin-M</p>
          </form>
        </div>
        
        <div className="absolute bottom-6 text-center w-full">
            <p className="text-[10px] text-gray-300 uppercase tracking-widest">
                Galvez-Santa Fe ARG
            </p>
        </div>
      </div>
    );
  }

  // --- RENDER: DASHBOARD ---
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-gray-800 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-md">
                <BrainCircuit className="text-white w-5 h-5" />
            </div>
            <div>
                <h1 className="text-lg font-bold leading-tight">FacturIA</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
                onClick={toggleAudio}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            >
                {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button 
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            >
                <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex-grow w-full">
        
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-800 rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in-down">
            <CheckCircle className="w-6 h-6" />
            <span className="font-medium text-sm">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in-down">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-medium text-sm">{errorMessage}</span>
          </div>
        )}

        {invoiceDraft ? (
          <InvoiceReview 
            data={invoiceDraft}
            onUpdate={setInvoiceDraft}
            onConfirm={handleFinalSubmit}
            onCancel={() => setInvoiceDraft(null)}
            isLoading={isProcessing}
          />
        ) : (
          <>
            <div className="text-center mb-8 mt-4">
               <h2 className="text-2xl font-bold text-gray-900 mb-2">¿Qué facturamos hoy?</h2>
               <p className="text-gray-500 text-sm">
                 Habla o escribe para generar el comprobante.
               </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100/50 mb-8">
                <VoiceInput onTranscript={handleVoiceTranscript} isProcessing={isProcessing} />
                
                <div className="mt-6 flex gap-2">
                    <input 
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && processRequest(inputText)}
                        placeholder="Ej: Factura C por..."
                        className="flex-grow bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none font-medium"
                        disabled={isProcessing}
                    />
                    <button 
                        onClick={() => processRequest(inputText)}
                        disabled={!inputText.trim() || isProcessing}
                        className="bg-black text-white px-4 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50"
                    >
                        Go
                    </button>
                </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;