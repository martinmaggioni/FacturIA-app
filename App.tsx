import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, InvoiceData } from './types';
import { parseInvoiceRequest } from './services/geminiService';
import { speak } from './services/ttsService';
import VoiceInput from './components/VoiceInput';
import InvoiceReview from './components/InvoiceReview';
import { LogOut, CheckCircle, Clock, Volume2, VolumeX, AlertTriangle, BrainCircuit, Settings, Key, FileKey, Server, Upload, Download, FileJson, Info } from 'lucide-react';

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

  const saveSettings = () => {
    localStorage.setItem('facturia_server_url', serverUrl);
    localStorage.setItem('facturia_cuit', cuit);
    localStorage.setItem('facturia_cert', cert);
    localStorage.setItem('facturia_key', key);
    setShowSettings(false);
    playAudio("Configuración guardada correctamente.");
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
    playAudio("Perfil exportado. Envíalo a tu otro dispositivo.");
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
        
        playAudio("Perfil importado exitosamente. Revisa los datos.");
      } catch (error) {
        setErrorMessage("Error al leer el archivo de perfil.");
        playAudio("El archivo no es válido.");
      }
    };
    reader.readAsText(file);
  };

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Validación simple: Requiere al menos CUIT para entrar al dashboard
    // En un caso real validaríamos contra el servidor, pero aquí asumimos que si tiene datos, puede intentar.
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
        playAudio(`Bienvenido a Facturía. Conectado al servidor.`);
      }, 500);
    } else {
        setShowSettings(true);
        playAudio("Por favor configura tus credenciales de ARCA primero.");
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
        posNumber: 1,
        ...data
      };
      setInvoiceDraft(completeData);
      playAudio("Borrador generado. Revisa los detalles.");
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
        // ENVIAMOS LA FACTURA + LAS CREDENCIALES
        // El servidor no guarda nada, usa las credenciales solo para esta operación (Stateless)
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
            // Intentar leer el error del JSON
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
             playAudio("Comprobante autorizado exitosamente.");
             setInvoiceDraft(null);
             setTimeout(() => setSuccessMessage(null), 8000);
        } else {
            throw new Error(result.message || "Error desconocido");
        }

    } catch (error: any) {
        console.error(error);
        const msg = `Error: ${error.message}. Revisa la IP del servidor o tus certificados.`;
        setErrorMessage(msg);
        playAudio("Error al conectar con el servidor.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- RENDER: PANTALLA DE CONFIGURACIÓN ---
  if (showSettings) {
      return (
        <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
            <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Settings className="w-6 h-6" /> Configuración
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-black">Cerrar</button>
                </div>

                {/* Export/Import Tools */}
                <div className="flex gap-3 mb-6">
                   <button 
                     onClick={handleExportProfile}
                     className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                   >
                      <Download className="w-4 h-4" /> Exportar Perfil
                   </button>
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                   >
                      <Upload className="w-4 h-4" /> Importar Perfil
                   </button>
                   <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleImportProfile}
                   />
                </div>
                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    
                    <div className="bg-blue-50 p-3 rounded-xl flex gap-3 border border-blue-100">
                        <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <p className="text-xs text-blue-800">
                            <strong>¿Misma cuenta, varios dispositivos?</strong>
                            <br/>Si tu papá y tú facturan para el mismo negocio, usen el botón "Exportar Perfil" para compartir las credenciales. Ambos deben tener cargados los <strong>mismos</strong> archivos .crt y .key.
                        </p>
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
                                placeholder="http://192.168.1.X:3001"
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Usa la IP de tu PC (si estás en casa) o la URL de Render (si estás fuera).</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">CUIT Emisor</label>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                            <Key className="w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
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
                            <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-1">
                                <FileKey className="w-4 h-4 text-blue-500" />
                                <span className="text-xs text-gray-400">Debe corresponder al CUIT de arriba</span>
                            </div>
                            <textarea 
                                value={cert}
                                onChange={(e) => setCert(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-xs font-mono h-20 resize-none"
                                placeholder="-----BEGIN CERTIFICATE----- ..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Clave Privada (.key)</label>
                        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                            <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-1">
                                <FileKey className="w-4 h-4 text-red-500" />
                                <span className="text-xs text-gray-400">Debe corresponder al CUIT de arriba</span>
                            </div>
                            <textarea 
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-xs font-mono h-20 resize-none"
                                placeholder="-----BEGIN PRIVATE KEY----- ..."
                            />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={saveSettings}
                    className="w-full mt-6 bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-all"
                >
                    Guardar Configuración
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
          <p className="text-center text-gray-500 mb-8 text-sm">Inteligencia Artificial para ARCA</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {cuit ? (
                <>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Ingresar como</p>
                        <p className="text-xl font-bold text-gray-800">{cuit}</p>
                        <p className="text-xs text-green-600 font-medium mt-1 flex justify-center items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Credenciales cargadas
                        </p>
                    </div>
                    
                    <button 
                      type="submit"
                      className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-transform transform active:scale-95 shadow-lg mt-4"
                    >
                      Ingresar
                    </button>

                     <button 
                      type="button"
                      onClick={() => setShowSettings(true)}
                      className="w-full bg-white text-gray-600 font-medium py-2 rounded-xl hover:bg-gray-50 border border-gray-200 flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" /> Modificar Datos
                    </button>
                </>
            ) : (
                <>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center text-blue-800 text-sm">
                        <p>Bienvenido. Para comenzar, configura tu CUIT y Certificados.</p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => setShowSettings(true)}
                      className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-transform transform active:scale-95 shadow-lg mt-4"
                    >
                      Comenzar Configuración
                    </button>
                </>
            )}
            
            <p className="text-center text-gray-400 text-xs mt-4 font-medium">Aplicación desarrollada por Martin-M</p>
          </form>
        </div>
        
        {/* Footer Fixed Bottom */}
        <div className="absolute bottom-6 text-center w-full">
            <p className="text-xs text-gray-400 font-medium tracking-wide">
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
                <h1 className="text-lg font-bold leading-tight tracking-tight">FacturIA</h1>
                <p className="text-xs text-gray-500 leading-none">CUIT {user.cuit}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                title={audioEnabled ? "Silenciar voz" : "Activar voz"}
            >
                {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button 
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            >
                <Settings className="w-5 h-5" />
            </button>
            <button 
                onClick={() => setUser(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
                <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex-grow w-full">
        
        {/* Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-800 rounded-2xl flex items-center gap-3 animate-fade-in-down shadow-sm">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-3 animate-fade-in-down shadow-sm">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Content */}
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
            <div className="text-center mb-10 mt-6">
               <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Hola, ¿qué facturamos?</h2>
               <p className="text-gray-500 max-w-md mx-auto">
                 Usa tu voz o escribe los detalles. <br/>
                 <span className="italic text-gray-400 text-sm">Ej: "Factura C por 2 consultorías a 15000 pesos."</span>
               </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100/50 mb-8 border border-white">
                <VoiceInput onTranscript={handleVoiceTranscript} isProcessing={isProcessing} />
                <div className="relative mt-4 mb-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold">
                        <span className="px-2 bg-white text-gray-300">Entrada Manual</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && processRequest(inputText)}
                        placeholder="Escribe los detalles aquí..."
                        className="flex-grow bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all placeholder-gray-400 font-medium"
                        disabled={isProcessing}
                    />
                    <button 
                        onClick={() => processRequest(inputText)}
                        disabled={!inputText.trim() || isProcessing}
                        className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all"
                    >
                        {isProcessing ? '...' : '->'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pendientes</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 tracking-tighter">0</p>
                    <p className="text-xs text-gray-400 mt-1 font-medium">Facturas programadas</p>
                </div>
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hoy</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 tracking-tighter">-</p>
                    <p className="text-xs text-gray-400 mt-1 font-medium">Total facturado</p>
                </div>
            </div>
          </>
        )}
      </main>
      
      <footer className="py-6 text-center border-t border-gray-200 mt-auto">
         <p className="text-xs text-gray-400 font-medium tracking-wide">
            Desarrollado por Martin-M , Galvez-Santa Fe ARG
        </p>
      </footer>
    </div>
  );
};

export default App;