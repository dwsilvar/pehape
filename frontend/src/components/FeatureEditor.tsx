import { FC, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button, List, ListItem, ListItemText, IconButton, Chip, Paper, CircularProgress } from '@mui/material';
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
import { FileData } from '../types';
import { ImageUploadDialog } from './ImageUploadDialog';

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
  const [selectedText, setSelectedText] = useState('');
  const [detectedTag, setDetectedTag] = useState<string | null>(null);
  const [localValidationTexts, setLocalValidationTexts] = useState<string[]>(validationTexts);

  // States for Gherkin Validation and Suggestions
  const [stepCatalog, setStepCatalog] = useState<{ type: string; pattern: string; location: string }[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    undefined_steps: { keyword: string; name: string; note?: string }[];
    snippets: string[];
  } | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<any>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [compactCatalog, setCompactCatalog] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const completionProviderRef = useRef<any>(null);

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
        const keywords = Object.keys(keywordsMap);
        const trimmedPrefix = textUntilPosition.trimStart();
        const keywordMatch = keywords.find(k => trimmedPrefix.startsWith(k));

        if (!keywordMatch) return { suggestions: [] };

        const currentType = keywordsMap[keywordMatch];

        // Calculate a safe range: from the end of the keyword to the current cursor
        const keywordEndColumn = lineContent.indexOf(keywordMatch) + keywordMatch.length + 1;
        const currentColumn = position.column;

        // Filter catalog based on type
        const filteredSteps = stepCatalog.filter(step => {
          if (currentType === 'and' || currentType === 'but') return true;
          return step.type.toLowerCase() === currentType;
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
    const disFeature = monacoInstance.languages.registerCompletionItemProvider('feature', provider);

    completionProviderRef.current = {
      dispose: () => {
        disGherkin.dispose();
        disFeature.dispose();
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

    editor.addAction({
      id: 'upload-ocr-image',
      label: t('editor.validate'), // O un label específico para OCR si existe
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const model = ed.getModel();
        const selection = ed.getSelection();
        if (model && selection && !selection.isEmpty()) {
          const text = model.getValueInRange(selection);

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

          setSelectedText(text);
          setDetectedTag(tag);
          setUploadDialogOpen(true);
        }
      }
    });

    // Add action for validation texts
    editor.addAction({
      id: 'add-to-validation-texts',
      label: t('editor.validation_texts'),
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.6,
      run: (ed) => {
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
  };

  const handleUploadImage = async (text: string, tag: string, file: File) => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('feature_path', selectedFile.path); // Relative path from features root
    formData.append('tag', tag);
    formData.append('text', text);
    formData.append('file', file);

    const response = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }
  };

  const handleValidate = async () => {
    if (!selectedFile || !monacoInstance || !editorInstance) return;

    setIsValidating(true);
    setValidationResult(null);

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
        <Box sx={{ p: 1, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            {selectedFile.path}
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
            scrollbar: {
              horizontal: 'auto',
              vertical: 'auto',
            },
            useShadowDOM: false, // ¡Esta es la clave! Evita que Mónaco cree un iframe que capture los eventos del ratón.
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

          {/* Error Alert */}
          {selectedFile && validationResult && !validationResult.valid && (
            <Paper elevation={3} sx={{ p: 1.5, borderTop: 1, borderColor: 'error.main', bgcolor: 'error.dark', color: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ErrorOutlineIcon sx={{ mr: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {t('editor.validation_failed', { count: validationResult.undefined_steps.length })}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <IconButton size="small" color="inherit" onClick={() => setValidationResult(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
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
                      </ListItem>
                    );
                  })}
              </List>
            )}
          </Box>
        </Paper>
      )}

      <ImageUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        initialText={selectedText}
        initialTag={detectedTag}
        featurePath={selectedFile?.path || ''}
        onUpload={handleUploadImage}
      />
    </Box >
  );
};