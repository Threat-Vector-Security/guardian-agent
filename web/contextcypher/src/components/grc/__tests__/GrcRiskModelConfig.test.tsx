/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GrcConfigRiskModelSection from '../GrcConfigRiskModelSection';
import { createDefaultGrcWorkspace } from '../../../services/GrcWorkspaceService';
import { GrcWorkspace } from '../../../types/GrcTypes';

describe('GRC risk model configuration', () => {
  const cloneWorkspace = (): GrcWorkspace =>
    JSON.parse(JSON.stringify(createDefaultGrcWorkspace())) as GrcWorkspace;

  it('supports dynamic matrix sizing and persists updated scales', () => {
    const workspace = cloneWorkspace();
    const applyWorkspace = jest.fn();
    const setStatusMessage = jest.fn();

    render(
      <GrcConfigRiskModelSection
        workspace={workspace}
        applyWorkspace={applyWorkspace}
        setStatusMessage={setStatusMessage}
        diagramSnapshot={null}
      />
    );

    expect(screen.getByText(/Matrix Size: 5 x 5/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add Likelihood Level' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Impact Level' }));

    expect(screen.getByText(/Matrix Size: 6 x 6/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save Risk Model' }));

    expect(applyWorkspace).toHaveBeenCalledTimes(1);
    const nextWorkspace = applyWorkspace.mock.calls[0][0] as GrcWorkspace;
    expect(nextWorkspace.riskModel.likelihoodScale.length).toBe(6);
    expect(nextWorkspace.riskModel.impactScale.length).toBe(6);
    expect(nextWorkspace.riskModel.matrix.length).toBe(36);
  });

  it('blocks appetite values above matrix maximum score', () => {
    const workspace = cloneWorkspace();
    const applyWorkspace = jest.fn();
    const setStatusMessage = jest.fn();

    render(
      <GrcConfigRiskModelSection
        workspace={workspace}
        applyWorkspace={applyWorkspace}
        setStatusMessage={setStatusMessage}
        diagramSnapshot={null}
      />
    );

    fireEvent.change(screen.getByLabelText('Risk Appetite Threshold (Score)'), {
      target: { value: '999' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Risk Model' }));

    expect(applyWorkspace).not.toHaveBeenCalled();
    expect(setStatusMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warning',
        text: expect.stringContaining('cannot exceed')
      })
    );
  });
});
