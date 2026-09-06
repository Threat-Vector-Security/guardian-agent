/**
 * GetStartedDialog - goal-based entry point for a threat modeling session.
 *
 * Replaces the content-centric onboarding prompt with four ways to begin:
 *   1. Describe your system  -> AI drafts the diagram (manual editing after)
 *   2. Model it manually     -> blank canvas + DFD quick palette
 *   3. Import a diagram      -> draw.io / Lucid XML / JSON import
 *   4. Explore the example   -> keep the preloaded example system
 *
 * Shipped behind the `v2Onboarding` feature flag until stable.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardActionArea
} from '@mui/material';
import {
  AutoAwesome as DescribeIcon,
  Edit as ManualIcon,
  Upload as ImportIcon,
  Map as ExampleIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import { GenerateDiagramButton, SaveConfirmationResult } from './GenerateDiagramButton';
import { useSettings } from '../settings/SettingsContext';
import { getTheme } from '../styles/Theme';

export interface RecentDiagramFileEntry {
  id: string;
  name: string;
  lastOpenedAt: number | string;
}

interface GetStartedDialogProps {
  open: boolean;
  onClose: () => void;
  recentFiles: RecentDiagramFileEntry[];
  onOpenRecent: (file: RecentDiagramFileEntry) => void;
  onStartManual: () => void;
  onOpenImport: () => void;
  onKeepExample: () => void;
  onDiagramGenerated: (diagram: any, shouldMerge?: boolean) => void;
  onSaveConfirmation: () => Promise<SaveConfirmationResult>;
}

interface GoalCard {
  id: 'describe' | 'manual' | 'import' | 'example';
  title: string;
  body: string;
  icon: React.ReactNode;
}

const GOALS: GoalCard[] = [
  {
    id: 'describe',
    title: 'Describe your system',
    body: 'Write a few sentences about what you are building — AI drafts the threat model diagram for you to refine.',
    icon: <DescribeIcon />
  },
  {
    id: 'manual',
    title: 'Model it manually',
    body: 'Start from a blank page with the DFD palette: actors, processes, data stores and trust boundaries.',
    icon: <ManualIcon />
  },
  {
    id: 'import',
    title: 'Import a diagram',
    body: 'Bring an existing draw.io / diagrams.net, Lucid XML export, Mermaid or JSON diagram.',
    icon: <ImportIcon />
  },
  {
    id: 'example',
    title: 'Explore the example',
    body: 'Look around a pre-built threat model with findings and attack paths to see how everything fits.',
    icon: <ExampleIcon />
  }
];

export const GetStartedDialog: React.FC<GetStartedDialogProps> = ({
  open,
  onClose,
  recentFiles,
  onOpenRecent,
  onStartManual,
  onOpenImport,
  onKeepExample,
  onDiagramGenerated,
  onSaveConfirmation
}) => {
  const { settings } = useSettings();
  const theme = getTheme(settings.theme, settings.customTheme);
  const colors = theme.colors as any;
  const [describeOpen, setDescribeOpen] = useState(false);
  const [description, setDescription] = useState('');

  const handleGoal = (goal: GoalCard['id']) => {
    switch (goal) {
      case 'describe':
        setDescribeOpen(true);
        break;
      case 'manual':
        onStartManual();
        onClose();
        break;
      case 'import':
        onOpenImport();
        onClose();
        break;
      case 'example':
        onKeepExample();
        onClose();
        break;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        {describeOpen ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" startIcon={<BackIcon />} onClick={() => setDescribeOpen(false)} sx={{ textTransform: 'none' }}>
              Back
            </Button>
            Describe your system
          </Box>
        ) : (
          <>
            What do you want to do?
            <Typography variant="body2" color="text.secondary">
              Every path leads to the same place: a diagram you can analyze, treat and report on.
            </Typography>
          </>
        )}
      </DialogTitle>
      <DialogContent>
        {describeOpen ? (
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              multiline
              minRows={6}
              fullWidth
              placeholder={
                'Describe the system in plain language — components, users, data, and how they connect.\n\n' +
                'e.g. "A customer-facing web app on AWS: React frontend behind CloudFront, an API on ECS, ' +
                'a PostgreSQL RDS database holding customer PII, S3 for document storage, and a third-party ' +
                'payments provider. Admins access via a bastion host."'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              helperText={
                description.trim().length < 50
                  ? `Keep going — at least 50 characters helps the AI draft something useful (${description.trim().length}/50)`
                  : 'Ready to generate. You can edit everything afterwards.'
              }
              sx={{ mb: 2 }}
            />
            <GenerateDiagramButton
              contextText={description}
              onDiagramGenerated={(diagram, shouldMerge) => {
                onDiagramGenerated(diagram, shouldMerge);
                onClose();
              }}
              onSaveConfirmation={onSaveConfirmation}
            />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, pt: 1 }}>
              {GOALS.map(goal => (
                <Card key={goal.id} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardActionArea onClick={() => handleGoal(goal.id)} sx={{ p: 2, height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, color: colors.primary }}>
                      {goal.icon}
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{goal.title}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {goal.body}
                    </Typography>
                  </CardActionArea>
                </Card>
              ))}
            </Box>

            {recentFiles.length > 0 && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${colors.border}` }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent threat models</Typography>
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  {recentFiles.slice(0, 4).map(file => (
                    <Button
                      key={file.id}
                      variant="outlined"
                      onClick={() => { onOpenRecent(file); onClose(); }}
                      sx={{ justifyContent: 'space-between', textTransform: 'none' }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 2, flexShrink: 0 }}>
                        {new Date(file.lastOpenedAt).toLocaleDateString()}
                      </Typography>
                    </Button>
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GetStartedDialog;
