/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GrcConfigDefaultsSection from '../GrcConfigDefaultsSection';
import { createDefaultGrcWorkspace } from '../../../services/GrcWorkspaceService';
import { GrcWorkspace } from '../../../types/GrcTypes';

describe('GRC defaults configuration presets', () => {
  const cloneWorkspace = (): GrcWorkspace =>
    JSON.parse(JSON.stringify(createDefaultGrcWorkspace())) as GrcWorkspace;

  it('requires confirmation before applying a rating preset', async () => {
    const workspace = cloneWorkspace();
    const applyWorkspace = jest.fn();
    const setStatusMessage = jest.fn();

    render(
      <GrcConfigDefaultsSection
        workspace={workspace}
        applyWorkspace={applyWorkspace}
        setStatusMessage={setStatusMessage}
        diagramSnapshot={null}
      />
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Rating Preset' }));
    fireEvent.click(screen.getByRole('option', { name: 'Compact 4-Level' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Preset' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/will clear your current in-editor rating/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeFalsy();
    });
    expect(screen.getByText(/Preview order: Catastrophic \(6\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Preset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Preset Changes' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeFalsy();
    });
    expect(screen.getByText(/Preview order: Extreme \(4\)/)).toBeTruthy();
    expect(applyWorkspace).toHaveBeenCalledTimes(1);
    expect(setStatusMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        text: expect.stringContaining('updated the matrix preview')
      })
    );
  });
});
