/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GrcAssessmentsTab from '../GrcAssessmentsTab';
import { vulnerableWebAppGrcWorkspace } from '../../../data/exampleSystems/vulnerableWebApp';
import { DiagramContextSnapshot, GrcWorkspace } from '../../../types/GrcTypes';
import { saveFile } from '../../../../../shared/file-dialogs';

jest.mock('../../../../../shared/file-dialogs', () => ({ saveFile: jest.fn(async () => true) }));

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

const AssessmentsHarness: React.FC = () => {
  const [workspace, setWorkspace] = React.useState<GrcWorkspace>(() => cloneWorkspace());
  return (
    <GrcAssessmentsTab
      workspace={workspace}
      applyWorkspace={setWorkspace}
      setStatusMessage={() => undefined}
      diagramSnapshot={diagramSnapshot}
    />
  );
};

describe('GRC assessments workspace', () => {
  beforeEach(() => {
    (saveFile as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates and edits assessment workspaces with TXT/HTML exports', async () => {
    render(<AssessmentsHarness />);

    expect(screen.getByText('New Assessment')).toBeTruthy();
    fireEvent.click(screen.getByText('New Assessment'));
    expect(screen.getByRole('button', { name: 'Create Assessment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export TXT' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeTruthy();

    const createTitleInput = screen.getAllByLabelText('Assessment Title')[0];
    fireEvent.change(createTitleInput, { target: { value: 'Quarterly App Review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Assessment' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Quarterly App Review')).toBeTruthy();
    });

    const findingsInput = screen.getByLabelText('Findings');
    fireEvent.change(findingsInput, { target: { value: 'Validated risk-control traceability in assessment workspace.' } });
    expect((findingsInput as HTMLInputElement).value).toContain('Validated risk-control traceability');

    fireEvent.click(screen.getByRole('button', { name: 'Export TXT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export HTML' }));
    expect(saveFile).toHaveBeenCalledTimes(2);
    expect((saveFile as jest.Mock).mock.calls[0][0]).toMatch(/assessment\.txt$/);
    expect((saveFile as jest.Mock).mock.calls[1][0]).toMatch(/assessment\.html$/);
  });
});
