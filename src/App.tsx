import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Code2, Play, Copy, Check, AlertCircle, Settings2, Braces, ListTree, Video, Search, Image as ImageIcon, Film } from 'lucide-react';
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
  const [output, setOutput] = useState('');
  const [parsedOutput, setParsedOutput] = useState<any>(null);
  const [generatedMedia, setGeneratedMedia] = useState<{ type: 'image' | 'video', url: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'raw' | 'viewer' | 'media'>('raw');
  const [isLoading, setIsLoading] = useState(false);
  const [isFindingVideo, setIsFindingVideo] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleFindVideo = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a topic to search for in the Video URL field.');
      return;
    }

    setIsFindingVideo(true);
    setError('');

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
        // Extract URL if there's extra text
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          setVideoUrl(urlMatch[0]);
        } else {
          setVideoUrl(text);
        }
      } else {
        setError('Could not find a valid video URL. Please try a different search term.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while searching for a video.');
    } finally {
      setIsFindingVideo(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
      });
      
      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
      
      if (imageUrl) {
        setGeneratedMedia({ type: 'image', url: imageUrl });
        setActiveTab('media');
      } else {
        setError('No image generated.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate image.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError('');
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
        prompt: prompt,
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
        setGeneratedMedia({ type: 'video', url: videoUrl });
        setActiveTab('media');
      } else {
        setError('No video generated.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate video.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }

    setIsLoading(true);
    setError('');
    setOutput('');
    setParsedOutput(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let systemInstruction = 'You are a helpful assistant that always responds with valid JSON. Do not include markdown formatting like ```json, just the raw JSON string.\n\nIf the prompt involves real-world entities, people, or places, use Google Search to find accurate public info. Automatically include a relevant high-quality image URL for them (e.g., in an `imageUrl` field).';
      
      if (useSchema && schema.trim()) {
        systemInstruction += `\n\nEnsure the output strictly follows this JSON schema:\n${schema}`;
      }

      let finalPrompt = prompt;
      if (videoUrl.trim()) {
        finalPrompt = `Video URL: ${videoUrl}\n\n${prompt}`;
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
          // Try to parse and re-stringify to ensure it's pretty-printed and valid
          const parsed = JSON.parse(response.text);
          setOutput(JSON.stringify(parsed, null, 2));
          setParsedOutput(parsed);
          setActiveTab('viewer');
        } catch (e) {
          // If parsing fails, just show the raw text
          setOutput(response.text);
          setParsedOutput(null);
          setActiveTab('raw');
        }
      } else {
        setError('No response generated.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating JSON.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
            <Code2 size={20} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Prompt to JSON</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-zinc-800 overflow-hidden">
        
        {/* Left Panel: Input */}
        <div className="bg-zinc-950 p-6 flex flex-col gap-6 overflow-y-auto">
          
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
                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
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
              className={`w-full flex-1 min-h-[200px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-100 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${!useSchema ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Play size={18} fill="currentColor" />
                Generate JSON
              </>
            )}
          </button>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleGenerateImage}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:cursor-not-allowed text-zinc-100 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /> : <ImageIcon size={18} />}
              Generate Image
            </button>
            <button
              onClick={handleGenerateVideo}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:cursor-not-allowed text-zinc-100 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /> : <Film size={18} />}
              Generate Video
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Right Panel: Output */}
        <div className="bg-zinc-950 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setActiveTab('viewer')}
                disabled={!parsedOutput}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                  activeTab === 'viewer' 
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <ListTree size={14} />
                JSON Viewer
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                  activeTab === 'raw' 
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Braces size={14} />
                Raw JSON
              </button>
              <button
                onClick={() => setActiveTab('media')}
                disabled={!generatedMedia}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                  activeTab === 'media' 
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <ImageIcon size={14} />
                Media
              </button>
            </div>
            <button
              onClick={handleCopy}
              disabled={!output}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-medium"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          
          <div className="flex-1 bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden relative group">
            {activeTab === 'media' && generatedMedia ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 bg-black">
                {generatedMedia.type === 'image' ? (
                  <img src={generatedMedia.url} alt="Generated" className="max-w-full max-h-full object-contain rounded-lg" />
                ) : (
                  <video src={generatedMedia.url} controls autoPlay className="max-w-full max-h-full rounded-lg" />
                )}
              </div>
            ) : output ? (
              <>
                {activeTab === 'raw' ? (
                  <textarea
                    value={output}
                    onChange={(e) => {
                      setOutput(e.target.value);
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setParsedOutput(parsed);
                      } catch (err) {
                        // ignore parse errors while typing
                      }
                    }}
                    className="absolute inset-0 w-full h-full p-6 bg-transparent text-sm font-mono text-zinc-300 resize-none focus:outline-none"
                    spellCheck={false}
                  />
                ) : (
                  <div className="absolute inset-0 overflow-auto p-6">
                    <JsonViewer data={parsedOutput} />
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm font-mono">
                // Output will appear here
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
