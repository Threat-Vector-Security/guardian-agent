// Example scenarios dropdown for targeted threat analysis
import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Tooltip,
  Divider,
  Alert
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import BugReportIcon from '@mui/icons-material/BugReport';
import InfoIcon from '@mui/icons-material/Info';
import { exampleThreatScenarios } from '../data/exampleThreatScenarios';

interface ExampleScenariosDropdownProps {
  onScenarioSelect: (scenario: any) => void;
}

const ExampleScenariosDropdown: React.FC<ExampleScenariosDropdownProps> = ({ onScenarioSelect }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleScenarioSelect = (scenario: any) => {
    const scenarioFile = {
      version: scenario.version,
      name: scenario.name,
      description: scenario.description,
      targetedAnalysis: scenario.targetedAnalysis,
      timestamp: scenario.timestamp
    };
    onScenarioSelect(scenarioFile);
    handleClose();
  };

  return (
    <>
      <Button
        variant="outlined"
        endIcon={<ArrowDropDownIcon />}
        onClick={handleClick}
        size="small"
        sx={{ 
          textTransform: 'none',
          borderColor: 'error.main',
          color: 'error.main',
          '&:hover': {
            borderColor: 'error.dark',
            backgroundColor: 'error.main',
            color: 'white'
          }
        }}
      >
        Example Scenarios
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { 
            minWidth: 380,
            maxWidth: 480,
            maxHeight: 600
          }
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Pre-built Threat Scenarios
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Load these scenarios and then load the associated example system to test
          </Typography>
        </Box>
        <Divider />
        {exampleThreatScenarios.map((scenario, index) => (
          <React.Fragment key={scenario.id}>
            {index > 0 && <Divider />}
            <MenuItem 
              onClick={() => handleScenarioSelect(scenario)}
              sx={{ 
                py: 2,
                px: 2,
                display: 'block',
                '&:hover': {
                  backgroundColor: 'error.main',
                  '& *': { color: 'white !important' }
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 'auto', mt: 0.5 }}>
                  <BugReportIcon color="error" />
                </ListItemIcon>
                <Box sx={{ flex: 1 }}>
                  <ListItemText 
                    primary={
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          wordWrap: 'break-word',
                          whiteSpace: 'normal',
                          lineHeight: 1.4,
                          overflowWrap: 'break-word'
                        }}
                      >
                        {scenario.name}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography 
                          variant="caption" 
                          color="text.secondary" 
                          sx={{ 
                            display: 'block', 
                            mt: 0.5,
                            wordWrap: 'break-word',
                            whiteSpace: 'normal',
                            overflowWrap: 'break-word'
                          }}
                        >
                          {scenario.description}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                          <InfoIcon sx={{ fontSize: 16, color: 'info.main' }} />
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'info.main',
                              fontWeight: 500,
                              wordWrap: 'break-word',
                              whiteSpace: 'normal',
                              overflowWrap: 'break-word'
                            }}
                          >
                            Recommended system: {scenario.systemName}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </Box>
              </Box>
            </MenuItem>
          </React.Fragment>
        ))}
        <Divider />
        <Box sx={{ p: 2 }}>
          <Alert severity="info" sx={{ py: 1 }}>
            <Typography variant="caption">
              <strong>Tip:</strong> After loading a scenario, use the Example Systems dropdown in the main toolbar to load the recommended system for testing targeted analysis.
            </Typography>
          </Alert>
        </Box>
      </Menu>
    </>
  );
};

export default ExampleScenariosDropdown;