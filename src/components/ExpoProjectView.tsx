import { Check, Copy, FileCode2, FolderOpen, Terminal } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { webApi } from '../api';
import { ExpoSourceFile } from '../types';

const EAS_COMMANDS = [
  {
    label: 'Android APK (Internal / Sideload)',
    profile: 'preview',
    command: 'cd expo-app && npx eas build --platform android --profile preview',
    artifact: 'Android .apk',
  },
  {
    label: 'Android Production AAB (Google Play)',
    profile: 'production',
    command: 'cd expo-app && npx eas build --platform android --profile production',
    artifact: 'Android .aab',
  },
  {
    label: 'iOS Production Build (App Store)',
    profile: 'production',
    command: 'cd expo-app && npx eas build --platform ios --profile production',
    artifact: 'iOS .ipa',
  },
];

export const ExpoProjectView: React.FC = () => {
  const [files, setFiles] = useState<ExpoSourceFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('expo-app/eas.json');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    webApi
      .getExpoFiles()
      .then((res) => {
        setFiles(res.files);
        const preferred =
          res.files.find((f) => f.path === 'expo-app/eas.json') || res.files[0];
        if (preferred) setSelectedPath(preferred.path);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedFile = files.find((f) => f.path === selectedPath);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Expo React Native & EAS Build Suite
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Complete standalone Expo SDK 52 TypeScript project in <code className="font-mono text-slate-900">expo-app/</code> using React Native components only, SecureStore JWT storage, Expo Notifications, and EAS build profiles.
        </p>
      </div>

      {/* EAS Build Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {EAS_COMMANDS.map((item) => (
          <div
            key={item.label}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">{item.label}</span>
              <span className="text-xs font-mono text-emerald-700 font-semibold">
                {item.artifact}
              </span>
            </div>
            <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-xs flex items-center justify-between gap-2">
              <span className="truncate">{item.command}</span>
              <button
                onClick={() => handleCopy(item.label, item.command)}
                className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
                title="Copy command"
              >
                {copiedId === item.label ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Profile: <span className="font-mono text-slate-700">{item.profile}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Source Explorer */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-3 px-2">
            <FolderOpen className="w-4 h-4 text-emerald-700" />
            <span>Expo Project Files ({files.length})</span>
          </div>
          {loading ? (
            <p className="text-xs text-slate-500 px-2">Loading project files...</p>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {files.map((f) => {
                const active = f.path === selectedPath;
                return (
                  <button
                    key={f.path}
                    onClick={() => setSelectedPath(f.path)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono flex items-center gap-2 transition-colors ${
                      active
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
                    <span className="truncate">{f.path}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-900">
              <Terminal className="w-4 h-4 text-slate-500" />
              <span>{selectedFile?.path || 'Select a file'}</span>
            </div>
            {selectedFile && (
              <button
                onClick={() => handleCopy('source', selectedFile.content)}
                className="min-h-[34px] px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
              >
                {copiedId === 'source' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy File
                  </>
                )}
              </button>
            )}
          </div>
          <pre className="flex-1 p-5 bg-slate-950 text-slate-100 text-xs font-mono overflow-auto max-h-[540px] leading-relaxed">
            <code>{selectedFile?.content || ''}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
