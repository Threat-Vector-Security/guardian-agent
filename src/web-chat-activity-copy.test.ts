import { describe, expect, it } from 'vitest';
import {
  resolveSafeWorkingActivity,
  resolveSafeWorkingLabel,
} from '../web/public/js/chat-activity-copy.js';

describe('resolveSafeWorkingLabel', () => {
  it('returns safe operational labels for normal chat work', () => {
    expect(resolveSafeWorkingLabel(0)).toBe('Reading the request…');
    expect(resolveSafeWorkingLabel(2_100)).toBe('Checking route and context…');
    expect(resolveSafeWorkingLabel(6_500)).toBe('Working with the selected model…');
    expect(resolveSafeWorkingLabel(12_500)).toBe('Still working; waiting on tools or provider…');
    expect(resolveSafeWorkingLabel(30_500)).toBe('Still working; this one is taking longer…');
  });

  it('returns approval-specific continuation labels', () => {
    expect(resolveSafeWorkingLabel(0, { mode: 'approval' })).toBe('Continuing after approval…');
    expect(resolveSafeWorkingLabel(2_100, { mode: 'approval' })).toBe('Checking continuation context…');
    expect(resolveSafeWorkingLabel(6_500, { mode: 'approval' })).toBe('Resuming the approved work…');
  });

  it('treats invalid elapsed values as fresh work', () => {
    expect(resolveSafeWorkingLabel(Number.NaN)).toBe('Reading the request…');
    expect(resolveSafeWorkingLabel(-500)).toBe('Reading the request…');
  });

  it('returns safe activity breadcrumbs without exposing hidden reasoning', () => {
    expect(resolveSafeWorkingActivity(2_100)).toEqual({
      label: 'Checking route and context…',
      items: [{
        title: 'Checking route and context…',
        detail: 'Choosing the right lane and loading the relevant context.',
      }],
    });
    expect(resolveSafeWorkingActivity(12_500, { mode: 'approval' })).toEqual({
      label: 'Still working; waiting on tools or provider…',
      items: [{
        title: 'Still working; waiting on tools or provider…',
        detail: 'Keeping the continuation open while external work finishes.',
      }],
    });
  });
});
