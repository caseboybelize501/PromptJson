import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Code2, Play, Copy, Check, AlertCircle, Settings2, Braces, ListTree, Video, Search, Image as ImageIcon, Film, Sparkles, Loader2 } from 'lucide-react';
import ReactPlayer from 'react-player';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const JsonViewer = ({ data, keyName }: { data: any; keyName?: string }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (data === null) return <span className="text-zinc-500">null</span>;
  if (typeof data === 'string') {
    const isVideo = data.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be|vimeo\.com)\/.+$/);
    const isImage = data.startsWith('http') && (keyName?.toLowerCase().includes('image') || data.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i));
    
    if (isVideo) {
      return (
        <div className="inline-block align-top w-full max-w-sm mt-1">
          <span className="text-emerald-400 break-all">"{data}"</span>
          <div className="mt-2 rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-video relative">
            {(() => {
              const Player = ReactPlayer as any;
              return <Player url={data} width="100%" height="100%" controls style={{ position: 'absolute', top: 0, left: 0 }} />;
            })()}
          </div>
        </div>
      );
    }

    return (
      <span className="inline-block align-top">
        <span className="text-emerald-400 break-all">"{data}"</span>
        {isImage && (
          <img src={data} alt="preview" className="block mt-2 max-h-40 max-w-xs rounded-md border border-zinc-700 object-contain bg-zinc-900/50" referrerPolicy="no-referrer" />
        )}
      </span>
    );
  }
  if (typeof data === 'number') return <span className="text-blue-400">{data}</span>;
  if (typeof data === 'boolean') return <span className="text-purple-400">{data ? 'true' : 'false'}</span>;
  
  const isArray = Array.isArray(data);
  const isEmpty = isArray ? data.length === 0 : Object.keys(data).length === 0;
  
  if (isEmpty) return <span className="text-zinc-500">{isArray ? '[]' : '{}'}</span>;

  return (
    <div className="font-mono text-sm leading-6">
      <span 
        className="cursor-pointer text-zinc-500 hover:text-zinc-300 select-none mr-1 text-xs inline-block w-4 text-center"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '▼' : '▶'}
      </span>
      <span className="text-zinc-400">{isArray ? '[' : '{'}</span>
      {!isExpanded && (
        <>
          <span className="text-zinc-500 mx-1">...</span>
          <span className="text-zinc-400">{isArray ? ']' : '}'}</span>
        </>
      )}
      
      {isExpanded && (
        <div className="pl-4 border-l border-zinc-800/50 ml-2 my-0.5">
          {isArray ? (
            data.map((item: any, i: number) => (
              <div key={i} className="py-0.5">
                <JsonViewer data={item} />
                {i < data.length - 1 && <span className="text-zinc-500">,</span>}
              </div>
            ))
          ) : (
            Object.entries(data).map(([key, value], i, arr) => (
              <div key={key} className="py-0.5 flex items-start">
                <div className="shrink-0 mr-1.5">
                  <span className="text-indigo-300">"{key}"</span>
                  <span className="text-zinc-500">:</span>
                </div>
                <div className="min-w-0">
                  <JsonViewer data={value} keyName={key} />
                  {i < arr.length - 1 && <span className="text-zinc-500">,</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {isExpanded && <div className="text-zinc-400 ml-2">{isArray ? ']' : '}'}</div>}
    </div>
  );
};

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [schema, setSchema] = useState('{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" },\n    "publicInfoSummary": { "type": "string" },\n    "imageUrl": { "type": "string", "description": "A valid URL to an image of the entity" }\n  }\n}');
  const [useSchema, setUseSchema] = useState(false);
  
  // State for the 3 concurrent generations
  const [jsonResult, setJsonResult] = useState<{ data: any; raw: string; isLoading: boolean; error: string }>({ data: null, raw: '', isLoading: false, error: '' });
  const [imageResult, setImageResult] = useState<{ url: string; isLoading: boolean; error: string }>({ url: '', isLoading: false, error: '' });
  const [videoResult, setVideoResult] = useState<{ url: string; isLoading: boolean; error: string }>({ url: '', isLoading: false, error: '' });

  const [isFindingVideo, setIsFindingVideo] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [copied, setCopied] = useState(false);
  const [jsonViewMode, setJsonViewMode] = useState<'viewer' | 'raw'>('viewer');

  const handleFindVideo = async () => {
    if (!videoUrl.trim()) {
      setGlobalError('Please enter a topic to search for in the Video URL field.');
      return;
    }

    setIsFindingVideo(true);
    setGlobalError('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Find a YouTube video about: "${videoUrl}". Return ONLY a valid YouTube video URL as plain text. Do not include any other text, markdown, or explanation.`,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1,
        },
      });

      const text = response.text?.trim();
      if (text && (text.includes('youtube.com') || text.includes('youtu.be'))) {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          setVideoUrl(urlMatch[0]);
        } else {
          setVideoUrl(text);
        }
      } else {
        setGlobalError('Could not find a valid video URL. Please try a different search term.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'An error occurred while searching for a video.');
    } finally {
      setIsFindingVideo(false);
    }
  };

  const generateJson = async (ai: GoogleGenAI, finalPrompt: string) => {
    setJsonResult({ data: null, raw: '', isLoading: true, error: '' });
    try {
      let systemInstruction = 'You are a helpful assistant that always responds with valid JSON. Do not include markdown formatting like ```json, just the raw JSON string.\n\nIf the prompt involves real-world entities, people, or places, use Google Search to find accurate public info. Automatically include a relevant high-quality image URL for them (e.g., in an `imageUrl` field).';
      
      if (useSchema && schema.trim()) {
        systemInstruction += `\n\nEnsure the output strictly follows this JSON schema:\n${schema}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: finalPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
          tools: [{ googleSearch: {} }],
        },
      });

      if (response.text) {
        try {
          const parsed = JSON.parse(response.text);
          setJsonResult({ data: parsed, raw: JSON.stringify(parsed, null, 2), isLoading: false, error: '' });
          setJsonViewMode('viewer');
        } catch (e) {
          setJsonResult({ data: null, raw: response.text, isLoading: false, error: '' });
          setJsonViewMode('raw');
        }
      } else {
        setJsonResult(prev => ({ ...prev, isLoading: false, error: 'No response generated.' }));
      }
    } catch (err: any) {
      setJsonResult(prev => ({ ...prev, isLoading: false, error: err.message || 'Failed to generate JSON.' }));
    }
  };

  const generateImage = async (ai: GoogleGenAI, promptText: string) => {
    setImageResult({ url: '', isLoading: true, error: '' });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: promptText,
      });
      
      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
      
      if (imageUrl) {
        setImageResult({ url: imageUrl, isLoading: false, error: '' });
      } else {
        setImageResult(prev => ({ ...prev, isLoading: false, error: 'No image generated.' }));
      }
    } catch (err: any) {
      setImageResult(prev => ({ ...prev, isLoading: false, error: err.message || 'Failed to generate image.' }));
    }
  };

  const generateVideo = async (promptText: string) => {
    setVideoResult({ url: '', isLoading: true, error: '' });
    try {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      }
      
      const currentApiKey = (typeof process !== 'undefined' && (process as any).env?.API_KEY) 
        ? (process as any).env.API_KEY 
        : process.env.GEMINI_API_KEY;
        
      const ai = new GoogleGenAI({ apiKey: currentApiKey as string });
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: promptText,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });
      
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }
      
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': currentApiKey as string,
          },
        });
        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);
        setVideoResult({ url: videoUrl, isLoading: false, error: '' });
      } else {
        setVideoResult(prev => ({ ...prev, isLoading: false, error: 'No video generated.' }));
      }
    } catch (err: any) {
      setVideoResult(prev => ({ ...prev, isLoading: false, error: err.message || 'Failed to generate video.' }));
    }
  };

  const handleGenerateMagic = async () => {
    if (!prompt.trim()) {
      setGlobalError('Please enter a prompt.');
      return;
    }

    setGlobalError('');
    
    let finalPrompt = prompt;
    if (videoUrl.trim()) {
      finalPrompt = `Video URL: ${videoUrl}\n\n${prompt}`;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    // Fire all 3 concurrently
    generateJson(ai, finalPrompt);
    generateImage(ai, prompt);
    generateVideo(prompt);
  };

  const handleCopyJson = () => {
    if (!jsonResult.raw) return;
    navigator.clipboard.writeText(jsonResult.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAnyLoading = jsonResult.isLoading || imageResult.isLoading || videoResult.isLoading;
  const hasAnyResult = jsonResult.raw || imageResult.url || videoResult.url;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
            <Sparkles size={20} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">AI Magic Workflow</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-px bg-zinc-800 overflow-hidden">
        
        {/* Left Panel: Input (4 columns) */}
        <div className="bg-zinc-950 p-6 flex flex-col gap-6 overflow-y-auto lg:col-span-4">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Video size={16} />
              Video URL or Search Topic
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste a URL or type a topic to search..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm"
              />
              <button
                onClick={handleFindVideo}
                disabled={isFindingVideo || !videoUrl.trim()}
                className="px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                {isFindingVideo ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                Find
              </button>
            </div>
            {videoUrl && (videoUrl.includes('http://') || videoUrl.includes('https://')) && (
              <div className="mt-2 rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-video relative">
                {(() => {
                  const Player = ReactPlayer as any;
                  return (
                    <Player
                      url={videoUrl}
                      width="100%"
                      height="100%"
                      controls
                      style={{ position: 'absolute', top: 0, left: 0 }}
                    />
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              Input Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Extract the user details from this text: John Doe is 30 years old."
              className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-mono text-sm"
            />
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Settings2 size={16} />
                JSON Schema (Optional)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSchema}
                  onChange={(e) => setUseSchema(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-950"
                />
                <span className="text-xs text-zinc-500">Enable Schema</span>
              </label>
            </div>
            
            <textarea
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              disabled={!useSchema}
              className={`w-full flex-1 min-h-[150px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-100 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${!useSchema ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          <button
            onClick={handleGenerateMagic}
            disabled={isAnyLoading}
            className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            {isAnyLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Sparkles size={20} />
                Automate Workflow
              </>
            )}
          </button>

          {globalError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{globalError}</p>
            </div>
          )}
        </div>

        {/* Right Panel: Results Dashboard (8 columns) */}
        <div className="bg-zinc-950 p-6 overflow-y-auto lg:col-span-8">
          {!hasAnyResult && !isAnyLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
              <Sparkles size={48} className="text-zinc-800" />
              <p>Enter a prompt and click "Automate Workflow" to generate JSON, Image, and Video simultaneously.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* JSON Result Card */}
              <div className="xl:col-span-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Braces size={18} className="text-indigo-400" />
                    Structured Data
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                      <button
                        onClick={() => setJsonViewMode('viewer')}
                        disabled={!jsonResult.data}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                          jsonViewMode === 'viewer' 
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        <ListTree size={14} />
                        Viewer
                      </button>
                      <button
                        onClick={() => setJsonViewMode('raw')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                          jsonViewMode === 'raw' 
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Code2 size={14} />
                        Raw
                      </button>
                    </div>
                    <button
                      onClick={handleCopyJson}
                      disabled={!jsonResult.raw}
                      className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-medium"
                    >
                      {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
                
                <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden relative min-h-[300px]">
                  {jsonResult.isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-3 bg-zinc-950/50 backdrop-blur-sm z-10">
                      <Loader2 size={24} className="animate-spin text-indigo-500" />
                      <span className="text-sm font-medium">Extracting data & searching web...</span>
                    </div>
                  ) : jsonResult.error ? (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-red-400 text-sm text-center">
                      {jsonResult.error}
                    </div>
                  ) : jsonResult.raw ? (
                    <div className="absolute inset-0 overflow-auto p-6">
                      {jsonViewMode === 'raw' ? (
                        <textarea
                          value={jsonResult.raw}
                          onChange={(e) => {
                            setJsonResult(prev => ({ ...prev, raw: e.target.value }));
                            try {
                              const parsed = JSON.parse(e.target.value);
                              setJsonResult(prev => ({ ...prev, data: parsed }));
                            } catch (err) {}
                          }}
                          className="w-full h-full bg-transparent text-sm font-mono text-zinc-300 resize-none focus:outline-none"
                          spellCheck={false}
                        />
                      ) : (
                        <JsonViewer data={jsonResult.data} />
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Image Result Card */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ImageIcon size={18} className="text-emerald-400" />
                  Generated Image
                </h2>
                <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden relative aspect-square flex items-center justify-center">
                  {imageResult.isLoading ? (
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-3">
                      <Loader2 size={24} className="animate-spin text-emerald-500" />
                      <span className="text-sm font-medium">Painting image...</span>
                    </div>
                  ) : imageResult.error ? (
                    <div className="p-6 text-red-400 text-sm text-center">
                      {imageResult.error}
                    </div>
                  ) : imageResult.url ? (
                    <img src={imageResult.url} alt="Generated" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-zinc-600 text-sm">Waiting for generation...</span>
                  )}
                </div>
              </div>

              {/* Video Result Card */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Film size={18} className="text-purple-400" />
                  Generated Video
                </h2>
                <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden relative aspect-square flex items-center justify-center">
                  {videoResult.isLoading ? (
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-3">
                      <Loader2 size={24} className="animate-spin text-purple-500" />
                      <span className="text-sm font-medium">Rendering video (takes a few mins)...</span>
                    </div>
                  ) : videoResult.error ? (
                    <div className="p-6 text-red-400 text-sm text-center">
                      {videoResult.error}
                    </div>
                  ) : videoResult.url ? (
                    <video src={videoResult.url} controls autoPlay loop className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-zinc-600 text-sm">Waiting for generation...</span>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

      </main>
    </div>
  );
}
