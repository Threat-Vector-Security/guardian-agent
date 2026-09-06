/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GrcModule from '../GrcModule';
import { vulnerableWebAppGrcWorkspace } from '../../../data/exampleSystems/vulnerableWebApp';
import { DiagramContextSnapshot, GrcWorkspace } from '../../../types/GrcTypes';
import { chatWithAnalysisResponse } from '../../../services/AIRequestService';
import { saveFile } from '../../../../../shared/file-dialogs';

jest.mock('../../../../../shared/file-dialogs', () => ({ saveFile: jest.fn(async () => true) }));

jest.mock('../../../settings/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      theme: 'dark',
      customTheme: {}
    }
  })
}));

jest.mock('../../ExamplesDropdown', () => function MockExamplesDropdown() {
  return null;
});

jest.mock('../../AnalysisPanel', () => {
  const React = require('react');
  const MockAnalysisPanel = (props: any) => {
    const [status, setStatus] = React.useState('idle');
    return (
      <div data-testid="mock-analysis-panel">
        <button
          onClick={async () => {
            const baseContext = {
              diagram: props.currentDiagram || { nodes: [], edges: [], metadata: {} },
              customContext: null,
              messageHistory: [],
              threatIntel: null,
              metadata: {}
            };
            const finalContext = props.contextAugmenter
              ? props.contextAugmenter(baseContext)
              : baseContext;
            await props.onSendMessage('Simulated GRC analysis request', finalContext);
            setStatus('sent');
          }}
        >
          Send AI Message
        </button>
        <div data-testid="mock-analysis-status">{status}</div>
      </div>
    );
  };
  return {
    __esModule: true,
    default: MockAnalysisPanel
  };
});

jest.mock('../../../services/AIRequestService', () => ({
  chatWithAnalysisResponse: jest.fn(async () => ({
    choices: [{ message: { content: 'Simulated AI response' } }],
    metadata: { provider: 'mock-provider', timestamp: new Date().toISOString(), isAnalysis: true }
  }))
}));

jest.mock('../../../api', () => ({
  importControlSet: jest.fn(async () => ({})),
  importControlSetXlsx: jest.fn(async () => ({})),
  previewControlSetImport: jest.fn(async () => ({}))
}));

const diagramSnapshot: DiagramContextSnapshot = {
  diagramId: 'vulnerable-web-app',
  systemName: 'Vulnerable Web App',
  nodes: [{ id: 'web-server', label: 'Web Server', type: 'webServer' }],
  edgeCount: 1,
  selectedNodeIds: ['web-server'],
  updatedAt: '2026-02-13T12:00:00.000Z'
};

const cloneWorkspace = (): GrcWorkspace =>
  JSON.parse(JSON.stringify(vulnerableWebAppGrcWorkspace)) as GrcWorkspace;

const GrcHarness: React.FC = () => {
  const [workspace, setWorkspace] = React.useState<GrcWorkspace>(() => cloneWorkspace());
  return (
    <GrcModule
      workspace={workspace}
      onWorkspaceChange={setWorkspace}
      onSwitchModule={() => undefined}
      diagramSnapshot={diagramSnapshot}
    />
  );
};

describe('GRC module workflow simulation', () => {
  beforeEach(() => {
    (saveFile as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs an end-to-end workflow including Workflow & Config and key UI components', async () => {
    render(<GrcHarness />);

    const orderedTabs = screen.getAllByRole('tab');
    expect(orderedTabs[0].textContent).toBe('Dashboard');
    expect(screen.getByRole('tab', { name: 'Dashboard' }).getAttribute('aria-selected')).toBe('true');
    const systemNameField = screen.getByPlaceholderText('System name...') as HTMLInputElement;
    expect(systemNameField.value).toBe('Vulnerable Web App');
    fireEvent.change(systemNameField, { target: { value: 'Updated GRC Simulation System' } });
    expect(systemNameField.value).toBe('Updated GRC Simulation System');
    expect(screen.getByRole('tab', { name: 'Workflow & Config' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Assets' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Risks' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Compliance' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Assessments' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Reporting' })).toBeTruthy();
    expect(screen.getByTestId('grc-analysis-panel-container')).toBeTruthy();
    expect(screen.getByTestId('mock-analysis-panel')).toBeTruthy();
    const analysisToggle = screen.getByLabelText('Toggle Analysis Panel');
    expect(analysisToggle).toBeTruthy();
    fireEvent.click(analysisToggle);
    fireEvent.click(analysisToggle);
    expect(screen.getByTestId('mock-analysis-panel')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Risks' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Risk Title')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Risk Title'), { target: { value: 'Simulated Session Token Leakage' } });
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'Security Engineering' } });
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-02-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Risk' }));

    await waitFor(() => {
      expect(screen.getByText('Added risk "Simulated Session Token Leakage".')).toBeTruthy();
    });
    expect(screen.getByText('Simulated Session Token Leakage')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Compliance' }));
    await waitFor(() => {
      expect(screen.getByText('Compliance and SoA')).toBeTruthy();
    });
    expect(screen.getByText('Compliance and SoA')).toBeTruthy();
    expect(screen.getByLabelText('SoA Scope')).toBeTruthy();
    expect(screen.getAllByText('Linked Risks').length).toBeGreaterThan(0);

    const justificationInputs = screen.getAllByPlaceholderText('Justification');
    fireEvent.change(justificationInputs[0], { target: { value: 'Validated in simulation' } });
    expect((justificationInputs[0] as HTMLInputElement).value).toContain('Validated in simulation');

    fireEvent.click(screen.getByRole('tab', { name: 'Workflow & Config' }));
    await waitFor(() => {
      expect(screen.getByText('Workflow Health')).toBeTruthy();
    });
    expect(screen.getByText('Workflow Health')).toBeTruthy();
    expect(screen.getByText('Practical Workflow Reference')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Task Board' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generate Tasks From Gaps' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Seed Onboarding' }));
    await waitFor(() => {
      expect(screen.getByText(/Added \d+ tasks from the Onboarding template\./)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate Tasks From Gaps' }));
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(
        /Generated \d+ workflow tasks from current GRC gaps\.|No new workflow tasks were generated\./
      );
    });

    fireEvent.change(screen.getByLabelText('Task Title'), { target: { value: 'Validate simulated control evidence package' } });
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'QA Automation' } });
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-02-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => {
      expect(screen.getByText('Added workflow task "Validate simulated control evidence package".')).toBeTruthy();
    });

    const newTaskCell = screen.getByText('Validate simulated control evidence package');
    const newTaskRow = newTaskCell.closest('tr');
    expect(newTaskRow).toBeTruthy();

    const taskStatusField = within(newTaskRow as HTMLTableRowElement).getByRole('combobox');
    fireEvent.mouseDown(taskStatusField);
    fireEvent.click(screen.getByRole('option', { name: 'In Progress' }));
    await waitFor(() => {
      expect(within(newTaskRow as HTMLTableRowElement).getByText('In Progress')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send AI Message' }));
    await waitFor(() => {
      expect(screen.getByTestId('mock-analysis-status').textContent).toBe('sent');
    });

    const mockedChat = chatWithAnalysisResponse as jest.MockedFunction<typeof chatWithAnalysisResponse>;
    expect(mockedChat).toHaveBeenCalled();
    const [, analysisContext] = mockedChat.mock.calls[mockedChat.mock.calls.length - 1];
    expect(analysisContext.additionalContext).toContain('=== GRC MODE FOCUS ===');
    expect(analysisContext.additionalContext).toContain('=== GRC WORKSPACE CONTEXT ===');

    fireEvent.click(screen.getByRole('tab', { name: 'Dashboard' }));
    await waitFor(() => {
      expect(screen.getByText('Workflow Tasks')).toBeTruthy();
    });
    expect(screen.getByText('Workflow Tasks')).toBeTruthy();
    expect(screen.getByText(/Overdue:/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Reporting' }));
    await waitFor(() => {
      expect(screen.getByText('Reporting & Export')).toBeTruthy();
    });
    expect(screen.getByText('Reporting & Export')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export Tasks CSV' })).toBeTruthy();
    expect(screen.getByText(/Open Tasks:/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Export Tasks CSV' }));
    expect(saveFile).toHaveBeenCalledWith(expect.stringMatching(/\.csv$/), expect.any(Blob));
  });
});
