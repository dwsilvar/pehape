import { FC, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Box, Typography, Button, List, ListItem, ListItemText, IconButton, Chip, Paper, CircularProgress, Snackbar, Alert, Menu, MenuItem } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RuleIcon from '@mui/icons-material/Rule';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import CloseIcon from '@mui/icons-material/Close';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewHeadlineIcon from '@mui/icons-material/ViewHeadline';
import LinkIcon from '@mui/icons-material/Link';
import { FileData } from '../types';
import { ImageUploadDialog } from './ImageUploadDialog';
import { ImageLinkDialog } from './ImageLinkDialog';

interface OCRImage {
  relative_path: string;
  filename: string;
  key_text: string;
  full_path_parts: string[];
  associated_texts?: string[];
  mapped_to?: { feature: string; tag: string | null; text?: string; full_steps?: string[] }[];
  is_mapped?: boolean;
}

interface FeatureEditorProps {
  selectedFile: FileData | null;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  theme: string; // Nueva prop para el tema
  onSave: () => void; // Nueva prop para guardar
  isDirty: boolean; // Nueva prop para saber si hay cambios
  isResizing: boolean; // Nueva prop para saber si se está redimensionando
  validationTexts?: string[]; // Nueva prop para textos a validar
  onValidationTextsChange?: React.Dispatch<React.SetStateAction<string[]>>; // Nueva prop para actualizar textos
}

export const FeatureEditor: FC<FeatureEditorProps> = ({ selectedFile, editorContent, onEditorChange, theme, onSave, isDirty, isResizing, validationTexts = [], onValidationTextsChange }) => {
  const { t } = useTranslation();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectedStepText, setSelectedStepText] = useState(''); // New state for full line text
  const [detectedTag, setDetectedTag] = useState<string | null>(null);
  const [localValidationTexts, setLocalValidationTexts] = useState<string[]>(validationTexts);

  // States for Keyword Association Menu
  const [associationAnchorEl, setAssociationAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedStepForAssociation, setSelectedStepForAssociation] = useState<{ pattern: string; location: string } | null>(null);

  // States for Gherkin Validation and Suggestions
  const [stepCatalog, setStepCatalog] = useState<{ type: string; pattern: string; location: string }[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'error' | 'warning' | 'info' | 'success'>('warning');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    undefined_steps: { keyword: string; name: string; note?: string }[];
    snippets: string[];
    error?: string | null;
  } | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<any>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [compactCatalog, setCompactCatalog] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [validatedWithUnsaved, setValidatedWithUnsaved] = useState(false);
  const completionProviderRef = useRef<any>(null);
  const hoverProviderRef = useRef<any>(null);
  const menuActionsRef = useRef<any[]>([]);
  const [ocrImages, setOcrImages] = useState<OCRImage[]>([]);
  const decorationsRef = useRef<string[]>([]);

  // Sincronizar estado local con props cuando cambian
  useEffect(() => {
    setLocalValidationTexts(validationTexts);
  }, [validationTexts]);

  // Fetch Step Catalog for IntelliSense
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const response = await fetch('/api/steps/catalog');
        if (response.ok) {
          const data = await response.json();
          setStepCatalog(data);
        } else {
          console.error('Step catalog fetch failed:', response.status);
        }
      } catch (error) {
        console.error('Error fetching step catalog:', error);
      }
    };
    fetchCatalog();
  }, []);

  // Fetch OCR Images
  useEffect(() => {
    const fetchOCRImages = async () => {
      try {
        const response = await fetch('/api/ocr-images');
        if (response.ok) {
          const data = await response.json();
          setOcrImages(data);
        }
      } catch (error) {
        console.error('Error fetching OCR images:', error);
      }
    };
    fetchOCRImages();
  }, [uploadDialogOpen]); // Refresh when dialog closes (might have uploaded new)

  // Update Completion Provider when catalog changes
  useEffect(() => {
    if (!monacoInstance || stepCatalog.length === 0) return;

    // Dispose old provider if exists
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    // Ensure gherkin is registered and has highlighting
    const registeredLangs = monacoInstance.languages.getLanguages();
    if (!registeredLangs.some((l: any) => l.id === 'gherkin')) {
      monacoInstance.languages.register({ id: 'gherkin', extensions: ['.feature'] });

      // Define basic highlighting for Gherkin
      monacoInstance.languages.setMonarchTokensProvider('gherkin', {
        keywords: [
          'Feature', 'Scenario', 'Given', 'When', 'Then', 'And', 'But', 'Background', 'Scenario Outline', 'Examples',
          'Característica', 'Escenario', 'Dado', 'Cuando', 'Entonces', 'Y', 'Pero', 'Antecedentes', 'Esquema del escenario', 'Ejemplos'
        ],
        tokenizer: {
          root: [
            [/@[^\s]+/, 'tag'], // Tags
            [/^[ \t]*#[^]*$/, 'comment'], // Comments
            [/[a-zA-Z\u00C0-\u017F]+(?=:)/, 'keyword'], // Keywords with colon like Feature:
            [/".*?"/, 'string'], // Double quoted strings
            [/'.*?'/, 'string'], // Single quoted strings
            [/[A-Z][a-z\u00C0-\u017F]+/, {
              cases: {
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }],
          ]
        }
      });
    }

    const provider = {
      triggerCharacters: [' ', '.', '"', "'"],
      provideCompletionItems: (model: any, position: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textUntilPosition = lineContent.substring(0, position.column - 1);

        // Match standard Gherkin keywords
        const keywordsMap: Record<string, string> = {
          'Given': 'given', 'When': 'when', 'Then': 'then', 'And': 'and', 'But': 'but',
          'Dado': 'given', 'Cuando': 'when', 'Entonces': 'then', 'Y': 'and', 'Pero': 'but'
        };
        // Parent keywords that define the step type context
        const parentKeywordsMap: Record<string, string> = {
          'Given': 'given', 'When': 'when', 'Then': 'then',
          'Dado': 'given', 'Cuando': 'when', 'Entonces': 'then'
        };
        const keywords = Object.keys(keywordsMap);
        const trimmedPrefix = textUntilPosition.trimStart();
        const keywordMatch = keywords.find(k => trimmedPrefix.startsWith(k));

        if (!keywordMatch) return { suggestions: [] };

        const currentType = keywordsMap[keywordMatch];

        // Calculate a safe range: from the end of the keyword to the current cursor
        const keywordEndColumn = lineContent.indexOf(keywordMatch) + keywordMatch.length + 1;
        const currentColumn = position.column;

        // Resolve effective step type:
        // For 'And'/'But', scan upward to find the nearest parent keyword (Given/When/Then)
        let effectiveType = currentType;
        if (currentType === 'and' || currentType === 'but') {
          const parentKeywords = Object.keys(parentKeywordsMap);
          for (let lineNum = position.lineNumber - 1; lineNum >= 1; lineNum--) {
            const prevLine = model.getLineContent(lineNum).trimStart();
            const parentMatch = parentKeywords.find(pk => prevLine.startsWith(pk));
            if (parentMatch) {
              effectiveType = parentKeywordsMap[parentMatch];
              break;
            }
          }
          // If no parent found (e.g. at top of file), fall through with all steps
          if (effectiveType === 'and' || effectiveType === 'but') {
            effectiveType = ''; // Show all when context is truly unknown
          }
        }

        // Filter catalog based on resolved effective type
        const filteredSteps = stepCatalog.filter(step => {
          if (!effectiveType) return true; // Unknown context: show all
          return step.type.toLowerCase() === effectiveType;
        });

        const suggestions = filteredSteps.map((step, idx) => {
          return {
            label: {
              label: step.pattern,
              detail: ` (${step.type.toUpperCase()})`,
              description: step.location.split('/').pop()?.split('\\').pop()
            },
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: step.pattern,
            filterText: step.pattern,
            sortText: `00${idx}`, // Force appearing at the top
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: keywordEndColumn + 1, // Start right after the keyword space
              endColumn: currentColumn
            }
          };
        });

        return { suggestions };
      }
    };

    const disGherkin = monacoInstance.languages.registerCompletionItemProvider('gherkin', provider);

    completionProviderRef.current = {
      dispose: () => {
        disGherkin.dispose();
      }
    };

    // Also register for 'plaintext' or other just in case
    // monacoInstance.languages.registerCompletionItemProvider('plaintext', ...);

    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
    };
  }, [monacoInstance, stepCatalog]);

  // Inject CSS for OCR decorations
  useEffect(() => {
    const styleId = 'monaco-ocr-decorations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
            .ocr-direct-link {
                border-bottom: 2px dashed #4caf50;
                cursor: help;
                background-color: rgba(76, 175, 80, 0.1);
            }
            .ocr-generic-link {
                border-bottom: 2px dashed #2196f3;
                cursor: help;
                background-color: rgba(33, 150, 243, 0.1);
            }
            .monaco-editor .monaco-hover {
                z-index: 9999 !important;
            }
            .monaco-hover-content img {
                max-width: 300px;
                max-height: 200px;
                border: 1px solid #ccc;
                margin-bottom: 8px;
            }
        `;
      document.head.appendChild(style);
    }
  }, []);

  // Effect to scan for OCR associations and apply decorations
  useEffect(() => {
    if (!editorInstance || !monacoInstance || ocrImages.length === 0 || !selectedFile) return;

    const model = editorInstance.getModel();
    if (!model) return;

    const content = model.getValue();
    const lines = content.split('\n');
    const newDecorations: any[] = [];

    // Normalize current path for comparison (no extension, forward slashes, no 'features/' prefix)
    const normalizePath = (p: string) => {
      let normalized = p.replace(/\\/g, '/').replace(/^\//, '');
      if (normalized.startsWith('features/')) {
        normalized = normalized.substring(9);
      }
      return normalized.replace('.feature', '');
    };
    const currentFeatureKey = normalizePath(selectedFile.path);

    // Heuristic to find tags for each line - Keep the @ to match mapping
    const lineTags: (string | null)[] = new Array(lines.length).fill(null);
    let currentTag: string | null = null;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('@')) {
        // Keep the whole tag including @ (e.g. "@successful")
        currentTag = trimmed.split(/\s+/)[0];
      }
      lineTags[i] = currentTag;
    }

    ocrImages.forEach(img => {
      // Logic for new mapped format
      if (img.mapped_to && img.mapped_to.length > 0) {
        img.mapped_to.forEach(m => {
          let isMatch = false;
          let matchType: 'direct' | 'generic' = 'direct';

          if (m.feature === 'generic') {
            isMatch = true;
            matchType = 'generic';
          } else {
            const mappedFeatureKey = normalizePath(m.feature);
            if (mappedFeatureKey === currentFeatureKey) {
              isMatch = true;
              matchType = 'direct';
            }
          }

          if (isMatch) {
            const textToMatch = m.text || img.key_text;
            if (!textToMatch) return;

            lines.forEach((line: string, lineIdx: number) => {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('#') || trimmedLine.startsWith('@') || trimmedLine === '') return;

              // Match tag if direct - Tag in mapping has @ (e.g. "@successful")
              if (matchType === 'direct' && m.tag && m.tag !== lineTags[lineIdx]) {
                return;
              }

              // NEW: Match the full step text to avoid ambiguity
              // If the mapping specifies full steps, the current line must be one of them.
              if (matchType === 'direct' && m.full_steps && m.full_steps.length > 0) {
                if (!m.full_steps.includes(trimmedLine)) {
                  return;
                }
              }

              // Permissive match: quotes or literal
              const escapedText = textToMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              // Matches "text", 'text' or just text.
              const regex = new RegExp(`(["'])${escapedText}\\1|${escapedText}`, 'g');
              let match;

              while ((match = regex.exec(line)) !== null) {
                const fullMatch = match[0];
                const matchIdx = match.index;

                newDecorations.push({
                  range: new monacoInstance.Range(lineIdx + 1, matchIdx + 1, lineIdx + 1, matchIdx + fullMatch.length + 1),
                  options: {
                    inlineClassName: matchType === 'generic' ? 'ocr-generic-link' : 'ocr-direct-link',
                    hoverMessage: [
                      {
                        value: `![${textToMatch}](${window.location.origin}/api/resources/images/${img.relative_path})\n\n**${t(`editor.ocr_association.${matchType}`)}**\n\n*ID: ${img.filename}*`,
                        isTrusted: true,
                        supportHtml: true
                      }
                    ],
                    stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                  }
                });
              }
            });
          }
        });
      } else {
        // --- Legacy Fallback (Legacy folder-based matching) ---
        const imgParts = img.full_path_parts;
        const isGeneric = imgParts[0] === 'features' && imgParts[1] === 'generic';

        // Re-implement folder-based matching logic
        const featurePathParts = currentFeatureKey.split(/[/\\]/).filter(Boolean);
        const featureName = featurePathParts.pop();
        const relDirParts = featurePathParts;

        let isCurrentFeature = false;
        let matchType: 'direct' | 'generic' = 'direct';

        if (isGeneric) {
          isCurrentFeature = true;
          matchType = 'generic';
        } else if (imgParts.length >= 3) {
          const imgFeatureName = imgParts[imgParts.length - 3];
          const imgRelDir = imgParts.slice(0, imgParts.length - 3).join('/');
          const currentRelDir = relDirParts.join('/');
          if (imgFeatureName === featureName && imgRelDir === currentRelDir) {
            isCurrentFeature = true;
          }
        }

        if (isCurrentFeature) {
          const keyText = img.key_text;
          const imgTag = isGeneric ? null : (imgParts.length >= 2 ? imgParts[imgParts.length - 2] : null);

          lines.forEach((line: string, lineIdx: number) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('#') || trimmedLine.startsWith('@') || trimmedLine === '') return;

            // Legacy tag check removed substring(1)
            const cleanedCurrentTag = lineTags[lineIdx]?.startsWith('@') ? lineTags[lineIdx]?.substring(1) : lineTags[lineIdx];
            if (matchType === 'direct' && imgTag && imgTag !== cleanedCurrentTag) return;

            if (line.includes(keyText)) {
              let startIdx = 0;
              while ((startIdx = line.indexOf(keyText, startIdx)) !== -1) {
                newDecorations.push({
                  range: new monacoInstance.Range(lineIdx + 1, startIdx + 1, lineIdx + 1, startIdx + keyText.length + 1),
                  options: {
                    inlineClassName: matchType === 'generic' ? 'ocr-generic-link' : 'ocr-direct-link',
                    hoverMessage: [{
                      value: `![${keyText}](${window.location.origin}/api/resources/images/${img.relative_path})\n\n**${t(`editor.ocr_association.${matchType}`)}**\n\n*ID: ${img.filename}*`,
                      isTrusted: true,
                      supportHtml: true
                    }],
                    stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                  }
                });
                startIdx += keyText.length;
              }
            }
          });
        }
      }
    });

    decorationsRef.current = editorInstance.deltaDecorations(decorationsRef.current, newDecorations);

    // Register Hover Provider if not registered
    if (!hoverProviderRef.current) {
      hoverProviderRef.current = monacoInstance.languages.registerHoverProvider('gherkin', {
        provideHover: (model: any, position: any) => {
          // Monaco already handles hoverMessage from decorations, 
          // but we could add more logic here if needed.
          return null;
        }
      });
    }

  }, [editorContent, ocrImages, selectedFile, monacoInstance, editorInstance, t]);

  // Usar validationTexts de props si está disponible, sino usar estado local
  const currentValidationTexts = onValidationTextsChange ? validationTexts : localValidationTexts;

  const handleAddValidationText = (text: string) => {
    if (!text) return;

    // Usar forma funcional de setState para evitar problemas de estado obsoleto
    if (onValidationTextsChange) {
      // Si hay callback del padre, usarlo con forma funcional
      onValidationTextsChange((prevTexts: string[]) => {
        if (prevTexts.includes(text)) {
          return prevTexts;
        }
        return [...prevTexts, text];
      });
    } else {
      // Si no, usar estado local con forma funcional
      setLocalValidationTexts((prevTexts: string[]) => {
        if (prevTexts.includes(text)) {
          return prevTexts;
        }
        return [...prevTexts, text];
      });
    }
  };

  const handleRemoveValidationText = (index: number) => {
    // Usar forma funcional de setState para evitar problemas de estado obsoleto
    if (onValidationTextsChange) {
      onValidationTextsChange((prevTexts: string[]) => prevTexts.filter((_: string, i: number) => i !== index));
    } else {
      setLocalValidationTexts((prevTexts: string[]) => prevTexts.filter((_: string, i: number) => i !== index));
    }
  };

  // Function to register context menu actions
  const registerMenuActions = () => {
    if (!editorInstance) return;

    // Dispose existing actions
    menuActionsRef.current.forEach(action => action?.dispose());
    menuActionsRef.current = [];

    // Register OCR upload action
    const ocrAction = editorInstance.addAction({
      id: 'upload-ocr-image',
      label: t('editor.upload_ocr_image'),
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed: any) => {
        const model = ed.getModel();
        const selection = ed.getSelection();
        if (model && selection && !selection.isEmpty()) {
          const text = model.getValueInRange(selection);

          // --- Quote Restriction Check ---
          // 1. Check if selection itself starts and ends with quotes
          const startsWithQuote = text.startsWith('"') || text.startsWith("'");
          const endsWithQuote = text.endsWith('"') || text.endsWith("'");

          let validatedText = text;
          let isValid = false;

          if (startsWithQuote && endsWithQuote) {
            // User selected the quotes too, strip them for the OCR key_text but it's valid
            validatedText = text.substring(1, text.length - 1);
            isValid = true;
          } else {
            // 2. Check surrounding characters in the model
            const beforeRange = new monacoInstance.Range(selection.startLineNumber, selection.startColumn - 1, selection.startLineNumber, selection.startColumn);
            const afterRange = new monacoInstance.Range(selection.endLineNumber, selection.endColumn, selection.endLineNumber, selection.endColumn + 1);

            const charBefore = model.getValueInRange(beforeRange);
            const charAfter = model.getValueInRange(afterRange);

            if ((charBefore === '"' && charAfter === '"') || (charBefore === "'" && charAfter === "'")) {
              isValid = true;
            }
          }

          if (!isValid) {
            setSnackbarMessage(t('editor.ocr_restriction_error') || 'Solo puedes asociar imágenes OCR a textos encerrados entre comillas (variables de los pasos).');
            setSnackbarSeverity('warning');
            setSnackbarOpen(true);
            return;
          }
          // --------------------------------

          const fullLineText = model.getLineContent(selection.startLineNumber).trim();

          // Heuristic to find the nearest tag upwards
          let tag = null;
          for (let i = selection.startLineNumber; i >= 1; i--) {
            const lineContent = model.getLineContent(i).trim();
            if (lineContent.startsWith('@')) {
              // Extract the first tag if multiple
              const tags = lineContent.split(/\s+/);
              tag = tags[0];
              break;
            }
          }

          setSelectedText(validatedText);
          setSelectedStepText(fullLineText);
          setDetectedTag(tag);
          setUploadDialogOpen(true);
        }
      }
    });

    // Register OCR link action
    const linkAction = editorInstance.addAction({
      id: 'link-ocr-image',
      label: t('editor.link_ocr_image', 'Vincular Imagen OCR Existente'),
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.55,
      run: (ed: any) => {
        const model = ed.getModel();
        const selection = ed.getSelection();
        if (model && selection && !selection.isEmpty()) {
          const text = model.getValueInRange(selection);

          // Reutilizar lógica de validación de comillas
          const startsWithQuote = text.startsWith('"') || text.startsWith("'");
          const endsWithQuote = text.endsWith('"') || text.endsWith("'");

          let validatedText = text;
          let isValid = false;

          if (startsWithQuote && endsWithQuote) {
            validatedText = text.substring(1, text.length - 1);
            isValid = true;
          } else {
            const beforeRange = new monacoInstance.Range(selection.startLineNumber, selection.startColumn - 1, selection.startLineNumber, selection.startColumn);
            const afterRange = new monacoInstance.Range(selection.endLineNumber, selection.endColumn, selection.endLineNumber, selection.endColumn + 1);
            const charBefore = model.getValueInRange(beforeRange);
            const charAfter = model.getValueInRange(afterRange);
            if ((charBefore === '"' && charAfter === '"') || (charBefore === "'" && charAfter === "'")) {
              isValid = true;
            }
          }

          if (!isValid) {
            setSnackbarMessage(t('editor.ocr_restriction_error'));
            setSnackbarSeverity('warning');
            setSnackbarOpen(true);
            return;
          }

          const fullLineText = model.getLineContent(selection.startLineNumber).trim();
          let tag = null;
          for (let i = selection.startLineNumber; i >= 1; i--) {
            const lineContent = model.getLineContent(i).trim();
            if (lineContent.startsWith('@')) {
              const tags = lineContent.split(/\s+/);
              tag = tags[0];
              break;
            }
          }

          setSelectedText(validatedText);
          setSelectedStepText(fullLineText);
          setDetectedTag(tag);
          setLinkDialogOpen(true);
        }
      }
    });

    // Register validation texts action
    const validationAction = editorInstance.addAction({
      id: 'add-to-validation-texts',
      label: t('editor.add_to_validation'),
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.6,
      run: (ed: any) => {
        const model = ed.getModel();
        const selection = ed.getSelection();
        if (model && selection && !selection.isEmpty()) {
          const text = model.getValueInRange(selection).trim();
          if (text) {
            handleAddValidationText(text);
          }
        }
      }
    });

    menuActionsRef.current = [ocrAction, linkAction, validationAction];
  };

  // Re-register menu actions when language changes
  useEffect(() => {
    if (editorInstance) {
      registerMenuActions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, editorInstance]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    const model = editor.getModel();
    if (model) {
      // Force language to gherkin if it's currently plaintext or something else
      const currentLang = model.getLanguageId();
      if (currentLang === 'plaintext' || currentLang === 'feature') {
        monaco.editor.setModelLanguage(model, 'gherkin');
      }
    }

    setMonacoInstance(monaco);
    setEditorInstance(editor);
  };

  const handleUploadImage = async (text: string, tag: string, file: File, isGeneric: boolean) => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('text', text);
    formData.append('step_text', selectedStepText); // Pass full context
    formData.append('file', file);
    formData.append('is_generic', isGeneric.toString());

    // Only add feature_path and tag if not generic
    if (!isGeneric) {
      formData.append('feature_path', selectedFile.path); // Relative path from features root
      formData.append('tag', tag);
    }

    const response = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }
  };

  const handleLinkImage = async (sourcePath: string, text: string, tag: string, isGeneric: boolean) => {
    if (!selectedFile) return;

    const response = await fetch('/api/images/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_relative_path: sourcePath,
        text,
        step_text: selectedStepText,
        feature_path: isGeneric ? null : selectedFile.path,
        tag: isGeneric ? null : tag,
        is_generic: isGeneric
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to link image');
    }

    // Refresh decorations after linking
    const imagesResponse = await fetch('/api/ocr-images');
    if (imagesResponse.ok) {
      const data = await imagesResponse.json();
      setOcrImages(data);
    }
  };

  const handleAssociateKeyword = async (targetKeyword: string) => {
    if (!selectedStepForAssociation) return;
    try {
      const response = await fetch('/api/steps/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: selectedStepForAssociation.pattern,
          location: selectedStepForAssociation.location,
          keyword: targetKeyword
        })
      });
      if (response.ok) {
        // Refresh catalog
        const catRes = await fetch('/api/steps/catalog');
        if (catRes.ok) {
          const freshCatalog = await catRes.json();
          setStepCatalog(freshCatalog);
        }
        setSnackbarSeverity('success');
        setSnackbarMessage(`Paso asociado correctamente como ${targetKeyword.toUpperCase()}`);
        setSnackbarOpen(true);
      } else {
        const errData = await response.json();
        setSnackbarSeverity('error');
        setSnackbarMessage(`Error al asociar: ${errData.detail || 'Fallo desconocido'}`);
        setSnackbarOpen(true);
      }
    } catch (err: any) {
      setSnackbarSeverity('error');
      setSnackbarMessage(`Error de conexión: ${err.message}`);
      setSnackbarOpen(true);
    } finally {
      setAssociationAnchorEl(null);
      setSelectedStepForAssociation(null);
    }
  };

  const handleValidate = async () => {
    if (!selectedFile || !monacoInstance || !editorInstance) return;

    setIsValidating(true);
    setValidationResult(null);
    setValidatedWithUnsaved(isDirty);

    // Clear existing markers
    monacoInstance.editor.setModelMarkers(editorInstance.getModel(), 'gherkin-validator', []);

    try {
      const response = await fetch('/api/features/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path }),
      });

      if (response.ok) {
        const data = await response.json();
        setValidationResult(data);

        if (!data.valid) {
          const markers: any[] = [];
          const model = editorInstance.getModel();
          const content = model.getValue();
          const lines = content.split('\n');

          data.undefined_steps.forEach((step: any) => {
            // Find the line for this step (basic heuristic)
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(step.name)) {
                markers.push({
                  severity: monacoInstance.MarkerSeverity.Error,
                  message: `${t('editor.undefined_step')}: ${step.keyword} ${step.name}`,
                  startLineNumber: i + 1,
                  startColumn: lines[i].indexOf(step.name) + 1,
                  endLineNumber: i + 1,
                  endColumn: lines[i].indexOf(step.name) + step.name.length + 1,
                  source: 'Gherkin Validator'
                });
              }
            }
          });

          monacoInstance.editor.setModelMarkers(model, 'gherkin-validator', markers);
        }
      }
    } catch (error) {
      console.error('Error validating feature:', error);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {isResizing && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10, // Asegura que esté por encima del editor
            backgroundColor: 'rgba(0,0,0,0.0)', // Transparente pero captura eventos
          }}
        />
      )}
      {selectedFile && (
        <Box sx={{ p: 1, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider', gap: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{
              flexGrow: 1,
              fontStyle: isDirty ? 'italic' : 'normal',
              color: isDirty ? 'warning.main' : 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              transition: 'color 0.2s ease',
            }}
          >
            {isDirty && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'warning.main',
                  flexShrink: 0,
                  boxShadow: '0 0 4px',
                  color: 'warning.main',
                }}
              />
            )}
            {selectedFile.path}
            {isDirty && (
              <Chip
                label={t('editor.unsaved')}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', fontStyle: 'normal' }}
              />
            )}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={isValidating ? <CircularProgress size={16} /> : <RuleIcon />}
            onClick={handleValidate}
            disabled={isValidating}
            sx={{ mr: 1 }}
          >
            {t('editor.validate')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RuleIcon />}
            onClick={() => setShowCatalog(!showCatalog)}
            sx={{ mr: 1 }}
          >
            {showCatalog ? t('editor.hide_steps') : t('editor.step_catalog')}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={!isDirty}
          >
            {t('common.save')}
          </Button>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}> {/* minHeight: 0 is crucial for child's scroll */}
        <MonacoEditor
          height="100%"
          value={selectedFile ? editorContent : `-- ${t('editor.placeholder')} --`}
          onChange={onEditorChange}
          options={{
            minimap: { enabled: true },
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: !selectedFile,
            theme: theme,
            wordWrap: 'off',
            fixedOverflowWidgets: true,
            scrollbar: {
              horizontal: 'auto',
              vertical: 'auto',
            },
            useShadowDOM: false,
          }}
          onMount={handleEditorDidMount}
          language={selectedFile ? 'gherkin' : undefined}
        />
      </Box>

      {/* Container for alerts and panels - No longer absolute to avoid hiding scrollbar */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        position: 'relative',
        zIndex: 30,
        pointerEvents: 'none',
        flexShrink: 0
      }}>
        <Box sx={{ pointerEvents: 'auto' }}>
          {/* Validation Texts Panel */}
          {selectedFile && currentValidationTexts.length > 0 && (
            <Paper elevation={2} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  {t('editor.validation_texts')} ({currentValidationTexts.length})
                </Typography>
              </Box>
              <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
                {currentValidationTexts.map((text, idx) => (
                  <ListItem
                    key={idx}
                    sx={{
                      bgcolor: 'rgba(76, 175, 80, 0.08)',
                      mb: 0.5,
                      borderRadius: 1,
                      border: '1px solid rgba(76, 175, 80, 0.2)'
                    }}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleRemoveValidationText(idx)}
                        title={t('common.delete')}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={text}
                      primaryTypographyProps={{
                        variant: 'body2',
                        sx: { fontFamily: 'monospace', fontSize: '0.85rem' }
                      }}
                    />
                  </ListItem>
                ))}
              </List>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('editor.validation_texts_hint')}
              </Typography>
            </Paper>
          )}

          {/* Unsaved warning banner shown whenever validation ran on a dirty file */}
          {validationResult && validatedWithUnsaved && (
            <Paper
              elevation={2}
              sx={{
                p: 1.5,
                borderTop: 2,
                borderColor: 'warning.main',
                bgcolor: 'warning.dark',
                color: 'warning.contrastText',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorOutlineIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 'medium', flexGrow: 1 }}>
                  {t('editor.validate_unsaved_warning')}
                </Typography>
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => setValidatedWithUnsaved(false)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Paper>
          )}

          {/* Error Alert */}
          {selectedFile && validationResult && !validationResult.valid && (
            <Paper elevation={3} sx={{ p: 1.5, borderTop: 1, borderColor: 'error.main', bgcolor: 'error.dark', color: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <ErrorOutlineIcon sx={{ mr: 1 }} />
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {validationResult.error 
                      ? "Error de ejecución al validar el feature"
                      : t('editor.validation_failed', { count: validationResult.undefined_steps.length })}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton size="small" color="inherit" onClick={() => setValidationResult(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                {validationResult.error && (
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{
                      width: '100%',
                      p: 1,
                      bgcolor: 'rgba(0,0,0,0.2)',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 120,
                      overflowY: 'auto'
                    }}
                  >
                    {validationResult.error}
                  </Typography>
                )}
              </Box>
            </Paper>
          )}

          {/* Snippets Panel */}
          {selectedFile && validationResult && validationResult.snippets.length > 0 && (
            <Paper elevation={4} sx={{ p: 2, borderTop: 2, borderColor: 'error.main', bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <RuleIcon sx={{ mr: 1, color: 'error.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                  {t('editor.step_catalog')} ({validationResult.snippets.length})
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ mb: 2, display: 'block' }}>
                {t('editor.steps_snippet_hint')}
              </Typography>
              <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
                {validationResult.snippets.map((snippet, idx) => (
                  <Box key={idx} sx={{ position: 'relative', mb: 2 }}>
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.900', color: 'grey.300', fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                      {snippet}
                    </Paper>
                    <IconButton
                      size="small"
                      sx={{ position: 'absolute', top: 5, right: 5, color: 'grey.500' }}
                      onClick={() => navigator.clipboard.writeText(snippet)}
                      title="Copiar snippet"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}

          {selectedFile && validationResult && validationResult.valid && (
            <Paper elevation={2} sx={{ p: 1.5, borderTop: 1, borderColor: 'success.main', bgcolor: 'success.dark', color: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircleIcon sx={{ mr: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {t('editor.validation_success')}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <IconButton size="small" color="inherit" onClick={() => setValidationResult(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Step Catalog Panel - Now part of the flex flow */}
      {showCatalog && (
        <Paper elevation={4} sx={{
          maxHeight: '40%',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          borderTop: 2,
          borderColor: 'primary.main',
          flexShrink: 0 // Important to keep its size
        }}>
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider', bgcolor: 'primary.dark', color: 'white' }}>
            <RuleIcon sx={{ mr: 1 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mr: 2 }}>
              {t('editor.step_catalog')} ({stepCatalog.length})
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label="GIVEN"
                size="small"
                onClick={() => setActiveFilter(activeFilter === 'given' ? null : 'given')}
                sx={{
                  bgcolor: activeFilter === 'given' ? '#4caf50' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontWeight: 'bold',
                  border: activeFilter === 'given' ? 'none' : '1px solid rgba(255,255,255,0.3)',
                  '&:hover': { bgcolor: '#4caf50' }
                }}
              />
              <Chip
                label="WHEN"
                size="small"
                onClick={() => setActiveFilter(activeFilter === 'when' ? null : 'when')}
                sx={{
                  bgcolor: activeFilter === 'when' ? '#2196f3' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontWeight: 'bold',
                  border: activeFilter === 'when' ? 'none' : '1px solid rgba(255,255,255,0.3)',
                  '&:hover': { bgcolor: '#2196f3' }
                }}
              />
              <Chip
                label="THEN"
                size="small"
                onClick={() => setActiveFilter(activeFilter === 'then' ? null : 'then')}
                sx={{
                  bgcolor: activeFilter === 'then' ? '#ff9800' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontWeight: 'bold',
                  border: activeFilter === 'then' ? 'none' : '1px solid rgba(255,255,255,0.3)',
                  '&:hover': { bgcolor: '#ff9800' }
                }}
              />
              {activeFilter && (
                <Chip
                  label="Limpiar filtros"
                  size="small"
                  onClick={() => setActiveFilter(null)}
                  variant="outlined"
                  sx={{ color: 'white', borderColor: 'white', fontWeight: 'bold' }}
                />
              )}
            </Box>

            <Box sx={{ flexGrow: 1 }} />
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setCompactCatalog(!compactCatalog)}
              title={compactCatalog ? "Vista Expandida" : "Vista Compacta"}
              sx={{ mr: 1 }}
            >
              {compactCatalog ? <ViewStreamIcon fontSize="small" /> : <ViewHeadlineIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" color="inherit" onClick={() => setShowCatalog(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ p: 1, overflow: 'auto', flex: 1, bgcolor: 'background.default' }}>
            {stepCatalog.filter(s => !activeFilter || s.type.toLowerCase() === activeFilter).length === 0 ? (
              <Typography variant="body2" sx={{ p: 2, textAlign: 'center', fontStyle: 'italic', color: 'text.secondary' }}>
                {activeFilter ? `No hay pasos de tipo ${activeFilter.toUpperCase()}` : 'No se encontraron pasos definidos'}
              </Typography>
            ) : (
              <List dense>
                {stepCatalog
                  .filter(s => !activeFilter || s.type.toLowerCase() === activeFilter)
                  .map((step, idx) => {
                    const typeColors: Record<string, string> = {
                      'given': '#4caf50', // Verde
                      'when': '#2196f3',  // Azul
                      'then': '#ff9800',  // Naranja
                      'and': '#9c27b0',   // Púrpura
                      'but': '#f44336'    // Rojo
                    };
                    const color = typeColors[step.type.toLowerCase()] || '#757575';

                    return (
                      <ListItem key={idx} divider sx={{ borderLeft: 4, borderColor: color, mb: 0.2, py: compactCatalog ? 0.2 : 1, bgcolor: 'background.paper' }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Chip
                                label={step.type.toUpperCase()}
                                size="small"
                                sx={{ mr: 1, bgcolor: color, color: 'white', fontWeight: 'bold', height: 18, fontSize: '0.6rem' }}
                              />
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                {step.pattern}
                              </Typography>
                            </Box>
                          }
                          secondary={!compactCatalog ? step.location : null}
                          secondaryTypographyProps={{ variant: 'caption', sx: { ml: 7 } }}
                        />
                        <IconButton size="small" title="Insertar en editor" onClick={() => {
                          if (editorInstance) {
                            const position = editorInstance.getPosition();
                            const model = editorInstance.getModel();
                            const lineContent = model.getLineContent(position.lineNumber);

                            const esKeywords = ['Dado', 'Cuando', 'Entonces', 'Y', 'Pero'];
                            const enKeywords = ['Given', 'When', 'Then', 'And', 'But'];
                            const allKeywords = [...esKeywords, ...enKeywords];
                            const trimmedLine = lineContent.trimStart();
                            const keywordMatch = allKeywords.find(k => trimmedLine.startsWith(k));

                            if (keywordMatch) {
                              // Find where the keyword ends to preserve indentation
                              const keywordIndex = lineContent.indexOf(keywordMatch);
                              const insertColumn = keywordIndex + keywordMatch.length + 2; // keyword + space

                              editorInstance.executeEdits('catalog-insert', [{
                                range: {
                                  startLineNumber: position.lineNumber,
                                  startColumn: insertColumn,
                                  endLineNumber: position.lineNumber,
                                  endColumn: lineContent.length + 1
                                },
                                text: step.pattern
                              }]);
                            } else if (trimmedLine === '') {
                              // Line is blank: search for parent keyword upwards
                              let parentKeyword = null;
                              for (let i = position.lineNumber - 1; i >= 1; i--) {
                                const lContent = model.getLineContent(i).trimStart();
                                const match = allKeywords.find(k => lContent.startsWith(k));
                                if (match) {
                                  parentKeyword = match;
                                  break;
                                }
                                // Stop if we hit a feature or scenario definition to avoid leaking context
                                if (lContent.startsWith('Feature:') || lContent.startsWith('Scenario:') || lContent.startsWith('Característica:') || lContent.startsWith('Escenario:')) {
                                  break;
                                }
                              }

                              if (parentKeyword) {
                                const isSpanish = esKeywords.includes(parentKeyword);
                                const prefix = isSpanish ? 'Y ' : 'And ';

                                editorInstance.executeEdits('catalog-insert', [{
                                  range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: lineContent.length + 1,
                                    endLineNumber: position.lineNumber,
                                    endColumn: lineContent.length + 1
                                  },
                                  text: prefix + step.pattern
                                }]);
                              } else {
                                editorInstance.executeEdits('catalog-insert', [{
                                  range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: position.column,
                                    endLineNumber: position.lineNumber,
                                    endColumn: position.column
                                  },
                                  text: step.pattern
                                }]);
                              }
                            } else {
                              editorInstance.executeEdits('catalog-insert', [{
                                range: {
                                  startLineNumber: position.lineNumber,
                                  startColumn: position.column,
                                  endLineNumber: position.lineNumber,
                                  endColumn: position.column
                                },
                                text: step.pattern
                              }]);
                            }
                            editorInstance.focus();
                          }
                        }}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Asociar a otro keyword" onClick={(e) => {
                          setAssociationAnchorEl(e.currentTarget);
                          setSelectedStepForAssociation(step);
                        }}>
                          <LinkIcon fontSize="small" />
                        </IconButton>
                      </ListItem>
                    );
                  })}
              </List>
            )}
          </Box>
        </Paper>
      )}

      <Menu
        anchorEl={associationAnchorEl}
        open={Boolean(associationAnchorEl)}
        onClose={() => {
          setAssociationAnchorEl(null);
          setSelectedStepForAssociation(null);
        }}
      >
        <MenuItem onClick={() => handleAssociateKeyword('given')}>Asociar como GIVEN (Dado)</MenuItem>
        <MenuItem onClick={() => handleAssociateKeyword('when')}>Asociar como WHEN (Cuando)</MenuItem>
        <MenuItem onClick={() => handleAssociateKeyword('then')}>Asociar como THEN (Entonces)</MenuItem>
      </Menu>

      <ImageUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUpload={handleUploadImage}
        initialText={selectedText}
        initialTag={detectedTag}
        featurePath={selectedFile?.path || ''}
      />

      <ImageLinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onLink={handleLinkImage}
        initialText={selectedText}
        initialTag={detectedTag}
        featurePath={selectedFile?.path || ''}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box >
  );
};