import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, Divider, IconButton, Slider, TextField, Tooltip, Typography } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import {
  buildRiskMatrix,
  rescoreRisks
} from '../../services/GrcWorkspaceService';
import { GrcRiskModel, RiskScaleValue } from '../../types/GrcTypes';
import { GrcTabProps, createId } from './grcShared';
import GrcRiskMatrixPreview from './GrcRiskMatrixPreview';

const MIN_SCALE_ITEMS = 3;
const MAX_SCALE_ITEMS = 10;

const nextScaleValue = (scale: RiskScaleValue[]): number =>
  Math.max(...scale.map(item => Number(item.value) || 0), 0) + 1;

const normalizeScaleDraft = (
  scale: RiskScaleValue[],
  prefix: 'likelihood' | 'impact'
): RiskScaleValue[] =>
  scale.map((item, index) => ({
    ...item,
    id: item.id || createId(prefix),
    label: item.label.trim() || `${prefix === 'likelihood' ? 'Likelihood' : 'Impact'} ${index + 1}`,
    value: Math.max(1, Math.round(Number(item.value) || index + 1))
  }));

const GrcConfigRiskModelSection: React.FC<GrcTabProps> = ({ workspace, applyWorkspace, setStatusMessage }) => {
  const [likelihoodDraft, setLikelihoodDraft] = useState<GrcRiskModel['likelihoodScale']>(
    workspace.riskModel.likelihoodScale
  );
  const [impactDraft, setImpactDraft] = useState<GrcRiskModel['impactScale']>(workspace.riskModel.impactScale);
  const [appetiteThresholdDraft, setAppetiteThresholdDraft] = useState<string>(
    String(workspace.riskModel.appetiteThresholdScore)
  );
  const maxDraftScore =
    Math.max(...likelihoodDraft.map(item => Number(item.value) || 0), 1) *
    Math.max(...impactDraft.map(item => Number(item.value) || 0), 1);
  const appetiteScore = Math.min(Math.max(Number(appetiteThresholdDraft) || 0, 0), maxDraftScore);

  useEffect(() => {
    setLikelihoodDraft(workspace.riskModel.likelihoodScale);
    setImpactDraft(workspace.riskModel.impactScale);
    setAppetiteThresholdDraft(String(workspace.riskModel.appetiteThresholdScore));
  }, [workspace.riskModel]);

  const handleAddLikelihood = useCallback(() => {
    setLikelihoodDraft(current => {
      if (current.length >= MAX_SCALE_ITEMS) {
        setStatusMessage({ severity: 'warning', text: `Likelihood scale cannot exceed ${MAX_SCALE_ITEMS} levels.` });
        return current;
      }
      return [
        ...current,
        {
          id: createId('likelihood'),
          label: `Likelihood ${current.length + 1}`,
          value: nextScaleValue(current)
        }
      ];
    });
  }, [setStatusMessage]);

  const handleAddImpact = useCallback(() => {
    setImpactDraft(current => {
      if (current.length >= MAX_SCALE_ITEMS) {
        setStatusMessage({ severity: 'warning', text: `Impact scale cannot exceed ${MAX_SCALE_ITEMS} levels.` });
        return current;
      }
      return [
        ...current,
        {
          id: createId('impact'),
          label: `Impact ${current.length + 1}`,
          value: nextScaleValue(current)
        }
      ];
    });
  }, [setStatusMessage]);

  const handleRemoveLikelihood = useCallback((index: number) => {
    setLikelihoodDraft(current => {
      if (current.length <= MIN_SCALE_ITEMS) {
        setStatusMessage({ severity: 'warning', text: `Likelihood scale requires at least ${MIN_SCALE_ITEMS} levels.` });
        return current;
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }, [setStatusMessage]);

  const handleRemoveImpact = useCallback((index: number) => {
    setImpactDraft(current => {
      if (current.length <= MIN_SCALE_ITEMS) {
        setStatusMessage({ severity: 'warning', text: `Impact scale requires at least ${MIN_SCALE_ITEMS} levels.` });
        return current;
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }, [setStatusMessage]);

  const handleSaveRiskModel = useCallback(() => {
    const appetite = Number(appetiteThresholdDraft);
    if (!Number.isFinite(appetite) || appetite <= 0) {
      setStatusMessage({ severity: 'warning', text: 'Risk appetite threshold must be a positive number.' });
      return;
    }

    if (
      likelihoodDraft.length < MIN_SCALE_ITEMS ||
      impactDraft.length < MIN_SCALE_ITEMS ||
      likelihoodDraft.length > MAX_SCALE_ITEMS ||
      impactDraft.length > MAX_SCALE_ITEMS
    ) {
      setStatusMessage({
        severity: 'warning',
        text: `Likelihood and impact must each contain ${MIN_SCALE_ITEMS}-${MAX_SCALE_ITEMS} levels.`
      });
      return;
    }

    const normalizedLikelihood = normalizeScaleDraft(likelihoodDraft, 'likelihood').sort((a, b) => a.value - b.value);
    const normalizedImpact = normalizeScaleDraft(impactDraft, 'impact').sort((a, b) => a.value - b.value);

    const likelihoodValues = normalizedLikelihood.map(item => item.value);
    const impactValues = normalizedImpact.map(item => item.value);

    if (new Set(likelihoodValues).size !== likelihoodValues.length) {
      setStatusMessage({ severity: 'warning', text: 'Likelihood values must be unique.' });
      return;
    }
    if (new Set(impactValues).size !== impactValues.length) {
      setStatusMessage({ severity: 'warning', text: 'Impact values must be unique.' });
      return;
    }

    const maxScore = Math.max(...likelihoodValues) * Math.max(...impactValues);
    if (appetite > maxScore) {
      setStatusMessage({
        severity: 'warning',
        text: `Risk appetite threshold cannot exceed the maximum matrix score (${maxScore}).`
      });
      return;
    }

    const nextRiskModel: GrcRiskModel = {
      ...workspace.riskModel,
      version: `v${Date.now()}`,
      likelihoodScale: normalizedLikelihood,
      impactScale: normalizedImpact,
      appetiteThresholdScore: appetite,
      matrix: buildRiskMatrix(normalizedLikelihood, normalizedImpact, appetite, workspace.config),
      updatedAt: new Date().toISOString()
    };

    const likelihoodIdSet = new Set(normalizedLikelihood.map(item => item.id));
    const impactIdSet = new Set(normalizedImpact.map(item => item.id));
    const fallbackLikelihoodId = normalizedLikelihood[0].id;
    const fallbackImpactId = normalizedImpact[0].id;

    let remappedScoreRefs = 0;
    const remappedRisks = workspace.risks.map(risk => {
      let changed = false;
      let inherentLikelihoodId = risk.inherentScore.likelihoodId;
      let inherentImpactId = risk.inherentScore.impactId;

      if (!likelihoodIdSet.has(inherentLikelihoodId)) {
        inherentLikelihoodId = fallbackLikelihoodId;
        remappedScoreRefs += 1;
        changed = true;
      }
      if (!impactIdSet.has(inherentImpactId)) {
        inherentImpactId = fallbackImpactId;
        remappedScoreRefs += 1;
        changed = true;
      }

      let nextResidual = risk.residualScore;
      if (risk.residualScore) {
        let residualChanged = false;
        let residualLikelihoodId = risk.residualScore.likelihoodId;
        let residualImpactId = risk.residualScore.impactId;

        if (!likelihoodIdSet.has(residualLikelihoodId)) {
          residualLikelihoodId = fallbackLikelihoodId;
          remappedScoreRefs += 1;
          residualChanged = true;
        }
        if (!impactIdSet.has(residualImpactId)) {
          residualImpactId = fallbackImpactId;
          remappedScoreRefs += 1;
          residualChanged = true;
        }

        if (residualChanged) {
          nextResidual = {
            ...risk.residualScore,
            likelihoodId: residualLikelihoodId,
            impactId: residualImpactId
          };
          changed = true;
        }
      }

      if (!changed) {
        return risk;
      }

      return {
        ...risk,
        inherentScore: {
          ...risk.inherentScore,
          likelihoodId: inherentLikelihoodId,
          impactId: inherentImpactId
        },
        residualScore: nextResidual,
        updatedAt: new Date().toISOString()
      };
    });

    const nextWorkspace = rescoreRisks({ ...workspace, riskModel: nextRiskModel, risks: remappedRisks });
    applyWorkspace(nextWorkspace);
    setStatusMessage({
      severity: 'success',
      text: remappedScoreRefs > 0
        ? `Risk model saved, all risks rescored, and ${remappedScoreRefs} score reference(s) were remapped.`
        : 'Risk model saved and all risks were rescored.'
    });
  }, [appetiteThresholdDraft, applyWorkspace, impactDraft, likelihoodDraft, workspace, setStatusMessage]);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Matrix Size: {likelihoodDraft.length} x {impactDraft.length} (supported range: {MIN_SCALE_ITEMS}-{MAX_SCALE_ITEMS})
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">Likelihood Scale</Typography>
            <Tooltip describeChild title="Add another likelihood level row to the current risk model." arrow>
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Plus size={14} />}
                  onClick={handleAddLikelihood}
                  disabled={likelihoodDraft.length >= MAX_SCALE_ITEMS}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Add Likelihood Level
                </Button>
              </span>
            </Tooltip>
          </Box>
          {likelihoodDraft.map((item, index) => (
            <Box key={item.id} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <Tooltip describeChild title="Label shown for this likelihood level in scoring selectors." arrow>
                <TextField size="small" label={`L${index + 1} Label`} value={item.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLikelihoodDraft(cur =>
                    cur.map((row, i) => i === index ? { ...row, label: e.target.value } : row)
                  )} />
              </Tooltip>
              <Tooltip describeChild title="Numeric weight used when calculating raw risk score." arrow>
                <TextField size="small" type="number" label="Value" value={item.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLikelihoodDraft(cur =>
                    cur.map((row, i) => i === index ? { ...row, value: Number(e.target.value) || 1 } : row)
                  )} sx={{ maxWidth: 120 }} />
              </Tooltip>
              <Tooltip describeChild title="Remove likelihood level">
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Remove likelihood ${index + 1}`}
                    onClick={() => handleRemoveLikelihood(index)}
                    disabled={likelihoodDraft.length <= MIN_SCALE_ITEMS}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ))}
        </Box>
        <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">Impact Scale</Typography>
            <Tooltip describeChild title="Add another impact level row to the current risk model." arrow>
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Plus size={14} />}
                  onClick={handleAddImpact}
                  disabled={impactDraft.length >= MAX_SCALE_ITEMS}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Add Impact Level
                </Button>
              </span>
            </Tooltip>
          </Box>
          {impactDraft.map((item, index) => (
            <Box key={item.id} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <Tooltip describeChild title="Label shown for this impact level in scoring selectors." arrow>
                <TextField size="small" label={`I${index + 1} Label`} value={item.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImpactDraft(cur =>
                    cur.map((row, i) => i === index ? { ...row, label: e.target.value } : row)
                  )} />
              </Tooltip>
              <Tooltip describeChild title="Numeric weight used when calculating raw risk score." arrow>
                <TextField size="small" type="number" label="Value" value={item.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImpactDraft(cur =>
                    cur.map((row, i) => i === index ? { ...row, value: Number(e.target.value) || 1 } : row)
                  )} sx={{ maxWidth: 120 }} />
              </Tooltip>
              <Tooltip describeChild title="Remove impact level">
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Remove impact ${index + 1}`}
                    onClick={() => handleRemoveImpact(index)}
                    disabled={impactDraft.length <= MIN_SCALE_ITEMS}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      <GrcRiskMatrixPreview
        likelihoodScale={likelihoodDraft}
        impactScale={impactDraft}
        appetiteThresholdScore={Number(appetiteThresholdDraft) || 0}
        config={workspace.config}
        helperText="Cells show score, rating, and whether the score is above appetite."
      />

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip describeChild title="Scores at or above this threshold are marked as above appetite." arrow>
          <TextField size="small" label="Risk Appetite Threshold (Score)" type="number"
            value={appetiteThresholdDraft} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppetiteThresholdDraft(e.target.value)}
            sx={{ maxWidth: 280 }}
            helperText={`Valid range: 1-${maxDraftScore}`} />
        </Tooltip>
        <Tooltip describeChild title="Adjust appetite threshold visually against the current matrix maximum." arrow>
          <Box sx={{ minWidth: 280, maxWidth: 460, px: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Appetite Slider (0-{maxDraftScore})
            </Typography>
            <Slider
              value={appetiteScore}
              min={0}
              max={maxDraftScore}
              step={1}
              onChange={(_, value) => setAppetiteThresholdDraft(String(Array.isArray(value) ? value[0] : value))}
              valueLabelDisplay="auto"
            />
          </Box>
        </Tooltip>
        <Chip
          size="small"
          label={`Appetite at ${maxDraftScore > 0 ? Math.round((appetiteScore / maxDraftScore) * 100) : 0}% of max score`}
          variant="outlined"
        />
        <Tooltip describeChild title="Save risk scales/appetite and rescore all risks against the updated matrix." arrow>
          <Button variant="contained" onClick={handleSaveRiskModel}>Save Risk Model</Button>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default GrcConfigRiskModelSection;
