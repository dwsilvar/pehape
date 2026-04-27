import React, { useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Tooltip, Collapse,
  List, ListItemButton, ListItemIcon, ListItemText, ListItemSecondaryAction,
  Paper, alpha, useTheme, Chip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import { useTranslation } from 'react-i18next';
import { TestPlan, TestCycle, TestFlow } from '../../types';

interface PlanHierarchyPanelProps {
  plans: TestPlan[];
  selectedPlanId: string | null;
  selectedCycleId: string | null;
  selectedFlowId: string | null;
  onSelectNode: (planId: string, cycleId: string | null, flowId: string | null) => void;
  onAddPlan: (name: string) => void;
  onAddCycle: (planId: string, name: string) => void;
  onAddFlow: (planId: string, cycleId: string, name: string) => void;
  onDeletePlan: (planId: string) => void;
  onDeleteCycle: (planId: string, cycleId: string) => void;
  onDeleteFlow: (planId: string, cycleId: string, flowId: string) => void;
}

const PlanHierarchyPanel: React.FC<PlanHierarchyPanelProps> = ({
  plans, selectedPlanId, selectedCycleId, selectedFlowId,
  onSelectNode, onAddPlan, onAddCycle, onAddFlow, onDeletePlan, onDeleteCycle, onDeleteFlow,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const statusColors: Record<string, string> = {
    draft: theme.palette.text.disabled,
    running: theme.palette.warning.main,
    completed: theme.palette.success.main,
  };

  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set());
  const [newPlanName, setNewPlanName] = useState('');
  const [addingCycleForPlan, setAddingCycleForPlan] = useState<string | null>(null);
  const [newCycleName, setNewCycleName] = useState('');
  const [addingFlowForCycle, setAddingFlowForCycle] = useState<string | null>(null);
  const [newFlowName, setNewFlowName] = useState('');
  const [showNewPlanInput, setShowNewPlanInput] = useState(false);

  const toggleExpand = (planId: string) => {
    setExpandedPlans(prev => {
      const next = new Set(prev);
      next.has(planId) ? next.delete(planId) : next.add(planId);
      return next;
    });
  };

  const toggleExpandCycle = (cycleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCycles(prev => {
      const next = new Set(prev);
      next.has(cycleId) ? next.delete(cycleId) : next.add(cycleId);
      return next;
    });
  };

  const handleAddPlan = () => {
    const name = newPlanName.trim();
    if (!name) return;
    onAddPlan(name);
    setNewPlanName('');
    setShowNewPlanInput(false);
  };

  const handleAddCycle = (planId: string) => {
    const name = newCycleName.trim();
    if (!name) return;
    onAddCycle(planId, name);
    setNewCycleName('');
    setAddingCycleForPlan(null);
    setExpandedPlans(prev => new Set([...prev, planId]));
  };

  const handleAddFlow = (planId: string, cycleId: string) => {
    const name = newFlowName.trim();
    if (!name) return;
    onAddFlow(planId, cycleId, name);
    setNewFlowName('');
    setAddingFlowForCycle(null);
    setExpandedCycles(prev => new Set([...prev, cycleId]));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        bgcolor: theme.palette.custom.bgSidebar,
      }}
    >
      {/* Panel header */}
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'action.hover',
          flexShrink: 0,
        }}
      >
        <AccountTreeRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        <Typography
          variant="overline"
          sx={{ flex: 1, fontSize: '0.62rem', letterSpacing: 1, color: 'text.secondary', fontWeight: 700 }}
        >
          {t('pages.testPlan.hierarchy')}
        </Typography>
        <Tooltip title={t('pages.testPlan.newPlan')}>
          <IconButton size="small" onClick={() => setShowNewPlanInput(v => !v)} sx={{ p: 0.3 }}>
            <AddRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* New plan input */}
      <Collapse in={showNewPlanInput}>
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder={t('pages.testPlan.enterName')}
            value={newPlanName}
            onChange={e => setNewPlanName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddPlan();
              if (e.key === 'Escape') { setShowNewPlanInput(false); setNewPlanName(''); }
            }}
            inputProps={{ style: { fontSize: '0.78rem' } }}
          />
        </Box>
      </Collapse>

      {/* Tree */}
      <Box sx={{ flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 } }}>
        {plans.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
              {t('pages.testPlan.noPlans')}
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {plans.map(plan => {
              const isExpanded = expandedPlans.has(plan.id);
              return (
                <React.Fragment key={plan.id}>
                  {/* Plan row */}
                  <ListItemButton
                    dense
                    onClick={() => {
                      toggleExpand(plan.id);
                      onSelectNode(plan.id, null, null);
                    }}
                    selected={plan.id === selectedPlanId && !selectedCycleId}
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      '&.Mui-selected': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      {isExpanded
                        ? <FolderOpenRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                        : <FolderRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                    </ListItemIcon>
                    <ListItemText
                      primary={`TP: ${plan.name}`}
                      primaryTypographyProps={{
                        sx: {
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                      }}
                    />
                    {/* Plan actions */}
                    <Box
                      sx={{ display: 'flex', opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 }, mr: 1, flexShrink: 0 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <Tooltip title={t('pages.testPlan.newCycle')}>
                        <IconButton
                          size="small"
                          sx={{ p: 0.3 }}
                          onClick={e => { e.stopPropagation(); setAddingCycleForPlan(plan.id); setNewCycleName(''); setExpandedPlans(p => new Set([...p, plan.id])); }}
                        >
                          <PlaylistAddRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('pages.testPlan.deletePlan')}>
                        <IconButton
                          size="small"
                          sx={{ p: 0.3, color: 'error.main' }}
                          onClick={e => { e.stopPropagation(); onDeletePlan(plan.id); }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {/* Status dot */}
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: statusColors[plan.status] || '#6b7280',
                        mr: 0.75,
                        flexShrink: 0,
                      }}
                    />
                    {isExpanded ? (
                      <ExpandLessRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                    ) : (
                      <ExpandMoreRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                    )}
                  </ListItemButton>

                  {/* Cycles */}
                  <Collapse in={isExpanded}>
                    {/* Add cycle input */}
                    {addingCycleForPlan === plan.id && (
                      <Box sx={{ pl: 4, pr: 1.5, py: 0.75, bgcolor: alpha(theme.palette.action.hover, 0.5) }}>
                        <TextField
                          size="small"
                          fullWidth
                          autoFocus
                          placeholder={t('pages.testPlan.enterName')}
                          value={newCycleName}
                          onChange={e => setNewCycleName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddCycle(plan.id);
                            if (e.key === 'Escape') { setAddingCycleForPlan(null); setNewCycleName(''); }
                          }}
                          inputProps={{ style: { fontSize: '0.75rem' } }}
                        />
                      </Box>
                    )}

                    {plan.cycles.length === 0 && addingCycleForPlan !== plan.id && (
                      <Box sx={{ pl: 4.5, py: 0.75 }}>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                          {t('pages.testPlan.noCycles')}
                        </Typography>
                      </Box>
                    )}

                    {plan.cycles.map(cycle => {
                      const isCycleExpanded = expandedCycles.has(cycle.id);
                      const isCycleSelected = plan.id === selectedPlanId && cycle.id === selectedCycleId && !selectedFlowId;
                      return (
                        <React.Fragment key={cycle.id}>
                          <ListItemButton
                            dense
                            selected={isCycleSelected}
                            onClick={() => {
                              onSelectNode(plan.id, cycle.id, null);
                            }}
                            sx={{
                              pl: 3.5,
                              pr: 1,
                              py: 0.4,
                              '&.Mui-selected': {
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 20 }}>
                              <IconButton size="small" onClick={(e) => toggleExpandCycle(cycle.id, e)} sx={{ p: 0 }}>
                                {isCycleExpanded ? <ExpandLessRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
                              </IconButton>
                            </ListItemIcon>
                            <ListItemText
                              primary={`TC: ${cycle.name}`}
                              primaryTypographyProps={{ sx: { fontSize: '0.75rem', fontWeight: isCycleSelected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                            />
                            
                            <Box sx={{ display: 'flex', opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 }, ml: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <Tooltip title={t('pages.testPlan.newFlow')}>
                                <IconButton
                                  size="small"
                                  sx={{ p: 0.3 }}
                                  onClick={e => { e.stopPropagation(); setAddingFlowForCycle(cycle.id); setNewFlowName(''); setExpandedCycles(p => new Set([...p, cycle.id])); }}
                                >
                                  <PlaylistAddRoundedIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('pages.testPlan.deleteCycle')}>
                                <IconButton
                                  size="small"
                                  sx={{ p: 0.3, color: 'error.main' }}
                                  onClick={e => { e.stopPropagation(); onDeleteCycle(plan.id, cycle.id); }}
                                >
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </ListItemButton>

                          {/* Flows */}
                          <Collapse in={isCycleExpanded}>
                            {/* Add flow input */}
                            {addingFlowForCycle === cycle.id && (
                              <Box sx={{ pl: 6, pr: 1.5, py: 0.75, bgcolor: alpha(theme.palette.action.hover, 0.5) }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  autoFocus
                                  placeholder={t('pages.testPlan.enterName')}
                                  value={newFlowName}
                                  onChange={e => setNewFlowName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleAddFlow(plan.id, cycle.id);
                                    if (e.key === 'Escape') { setAddingFlowForCycle(null); setNewFlowName(''); }
                                  }}
                                  inputProps={{ style: { fontSize: '0.75rem' } }}
                                />
                              </Box>
                            )}

                            {(!cycle.flows || cycle.flows.length === 0) && addingFlowForCycle !== cycle.id && (
                              <Box sx={{ pl: 6.5, py: 0.75 }}>
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                                  No hay flujos
                                </Typography>
                              </Box>
                            )}

                            {(cycle.flows || []).map(flow => {
                              const isFlowSelected = plan.id === selectedPlanId && cycle.id === selectedCycleId && flow.id === selectedFlowId;
                              return (
                                <ListItemButton
                                  key={flow.id}
                                  dense
                                  selected={isFlowSelected}
                                  onClick={() => onSelectNode(plan.id, cycle.id, flow.id)}
                                  sx={{
                                    pl: 6,
                                    pr: 1,
                                    py: 0.4,
                                    '&.Mui-selected': {
                                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                                      borderLeft: `2px solid ${theme.palette.primary.main}`,
                                    },
                                    '&.Mui-selected:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
                                  }}
                                >
                                  <ListItemIcon sx={{ minWidth: 20 }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isFlowSelected ? 'primary.main' : 'text.disabled', ml: 0.5 }} />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={`TF: ${flow.name}`}
                                    secondary={`${(flow.scenarios || []).length} escenarios`}
                                    primaryTypographyProps={{ sx: { fontSize: '0.73rem', fontWeight: isFlowSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                                    secondaryTypographyProps={{ sx: { fontSize: '0.62rem' } }}
                                  />
                                  <Tooltip title={t('pages.testPlan.deleteFlow')}>
                                    <Box sx={{ display: 'flex', opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 }, ml: 1, flexShrink: 0 }}>
                                      <IconButton
                                        size="small"
                                        sx={{ p: 0.3, color: 'error.main' }}
                                        onClick={e => { e.stopPropagation(); onDeleteFlow(plan.id, cycle.id, flow.id); }}
                                      >
                                        <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                      </IconButton>
                                    </Box>
                                  </Tooltip>
                                </ListItemButton>
                              );
                            })}
                          </Collapse>
                        </React.Fragment>
                      );
                    })}
                  </Collapse>
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default PlanHierarchyPanel;
