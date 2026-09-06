import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material';
import { GrcTabProps } from './grcShared';
import GrcConfigRiskModelSection from './GrcConfigRiskModelSection';
import GrcConfigDefaultsSection from './GrcConfigDefaultsSection';
import GrcConfigAppetiteSection from './GrcConfigAppetiteSection';
import GrcConfigWorkflowSection from './GrcConfigWorkflowSection';
import GrcConfigTaskBoardSection from './GrcConfigTaskBoardSection';
import GrcConfigTechnicalReferenceSection from './GrcConfigTechnicalReferenceSection';

type ConfigSectionId = 'workflow_reference' | 'task_board' | 'risk_model' | 'risk_appetite' | 'defaults_display' | 'technical_reference';

interface ConfigSectionMeta {
  id: ConfigSectionId;
  label: string;
  tooltip: string;
}

const GrcConfigurationTab: React.FC<GrcTabProps> = (props) => {
  const persistedView = props.getTabViewState?.('workflow_config', {
    activeSection: 'workflow_reference'
  }) ?? {
    activeSection: 'workflow_reference'
  };
  const [activeSection, setActiveSection] = useState<ConfigSectionId>(
    (persistedView.activeSection as ConfigSectionId) || 'workflow_reference'
  );

  useEffect(() => {
    if (props.focusRequest?.tab === 'workflow_config' && props.focusRequest.entityId) {
      setActiveSection('task_board');
    }
  }, [props.focusRequest]);

  useEffect(() => {
    props.setTabViewState?.('workflow_config', {
      activeSection
    });
  }, [activeSection, props.setTabViewState]);

  const sections = useMemo<ConfigSectionMeta[]>(
    () => [
      {
        id: 'workflow_reference',
        label: 'Workflow & Health',
        tooltip: 'Workflow health indicators, risk matrix preview, and end-to-end operating reference.'
      },
      {
        id: 'task_board',
        label: 'Task Board',
        tooltip: 'Create, track, and manage workflow tasks with gap generation and template seeding.'
      },
      {
        id: 'risk_model',
        label: 'Risk Model',
        tooltip: 'Configure likelihood/impact scales, appetite threshold, and matrix behavior.'
      },
      {
        id: 'risk_appetite',
        label: 'Risk Appetite',
        tooltip: 'Define scoped appetite rules that override the global threshold for specific domains, tiers, or criticality levels.'
      },
      {
        id: 'defaults_display',
        label: 'Defaults & Display',
        tooltip: 'Configure asset categories, criticality ratings, labels, exports, and AI assist context.'
      },
      {
        id: 'technical_reference',
        label: 'Technical Reference',
        tooltip: 'Comprehensive reference for entity types, relationships, tier taxonomy, status lifecycles, scoring, and integration points.'
      }
    ],
    []
  );

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 1.5, pt: 1.5, pb: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Workflow & Config Sections
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Active section: {sections.find(section => section.id === activeSection)?.label}
          </Typography>
          <Tabs
            value={activeSection}
            onChange={(_: React.SyntheticEvent, value: ConfigSectionId) => setActiveSection(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': {
                height: 3,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3
              },
              '& .MuiTab-root': {
                minHeight: 40,
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px 8px 0 0',
                mr: 0.75,
                color: 'text.secondary',
                border: '1px solid transparent',
                borderBottom: 'none',
                minWidth: 'fit-content',
                px: 1.5
              },
              '& .MuiTab-root.Mui-selected': {
                color: 'text.primary',
                backgroundColor: 'background.paper',
                borderColor: 'divider'
              }
            }}
          >
            {sections.map(section => (
              <Tab
                key={section.id}
                value={section.id}
                label={(
                  <Tooltip describeChild title={section.tooltip} arrow>
                    <span>{section.label}</span>
                  </Tooltip>
                )}
              />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ p: 2 }}>
          <Box sx={{ display: activeSection === 'workflow_reference' ? 'block' : 'none' }}>
            <GrcConfigWorkflowSection {...props} />
          </Box>
          <Box sx={{ display: activeSection === 'task_board' ? 'block' : 'none' }}>
            <GrcConfigTaskBoardSection {...props} />
          </Box>
          <Box sx={{ display: activeSection === 'risk_model' ? 'block' : 'none' }}>
            <GrcConfigRiskModelSection {...props} />
          </Box>
          <Box sx={{ display: activeSection === 'risk_appetite' ? 'block' : 'none' }}>
            <GrcConfigAppetiteSection {...props} />
          </Box>
          <Box sx={{ display: activeSection === 'defaults_display' ? 'block' : 'none' }}>
            <GrcConfigDefaultsSection {...props} />
          </Box>
          <Box sx={{ display: activeSection === 'technical_reference' ? 'block' : 'none' }}>
            <GrcConfigTechnicalReferenceSection {...props} />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default GrcConfigurationTab;
