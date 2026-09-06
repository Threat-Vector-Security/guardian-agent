import { calculateRiskScore, createDefaultConfig, createDefaultRiskModel } from '../GrcWorkspaceService';

describe('GRC rating band configuration', () => {
  it('uses the expected default six-level rating bands', () => {
    const config = createDefaultConfig();
    const labelsWithValues = config.ratingBands.map(band => `${band.label} (${band.value})`);

    expect(labelsWithValues).toEqual([
      'Catastrophic (6)',
      'Severe (5)',
      'Major (4)',
      'Moderate (3)',
      'Minor (2)',
      'Negligible (1)'
    ]);
  });

  it('applies configurable rating thresholds when scoring', () => {
    const config = createDefaultConfig();
    config.ratingBands = [
      { id: 'rating-red', label: 'Red', value: 3, minScoreRatio: 0.8, color: '#dc2626' },
      { id: 'rating-amber', label: 'Amber', value: 2, minScoreRatio: 0.4, color: '#f59e0b' },
      { id: 'rating-green', label: 'Green', value: 1, minScoreRatio: 0, color: '#16a34a' }
    ];

    const riskModel = createDefaultRiskModel(config);
    const greenScore = calculateRiskScore(riskModel, 'likelihood-3', 'impact-3', config); // 9/25 = 0.36
    const redScore = calculateRiskScore(riskModel, 'likelihood-5', 'impact-4', config); // 20/25 = 0.8

    expect(greenScore.ratingLabel).toBe('Green');
    expect(redScore.ratingLabel).toBe('Red');
    expect(redScore.color).toBe('#dc2626');
  });
});
