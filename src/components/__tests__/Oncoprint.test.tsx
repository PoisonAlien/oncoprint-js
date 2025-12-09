import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { Oncoprint } from '../Oncoprint';
import { OncoprintVisualizer } from '../../core';

// Mock the OncoprintVisualizer
jest.mock('../../core', () => {
  return {
    OncoprintVisualizer: jest.fn().mockImplementation(() => {
      const mockLoadMafData = jest.fn().mockResolvedValue(undefined);
      const mockLoadMetadataData = jest.fn().mockResolvedValue(undefined);
      const mockRender = jest.fn();

      return {
        loadMafData: mockLoadMafData,
        loadMetadataData: mockLoadMetadataData,
        loadMafFile: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
        loadMetadataFile: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
        render: mockRender,
        on: jest.fn(),
        off: jest.fn(),
        setConfig: jest.fn(),
        updateConfig: jest.fn(),
        resize: jest.fn(),
        exportSVG: jest.fn().mockReturnValue('mock-svg'),
        destroy: jest.fn(),
        _mockLoadMafData: mockLoadMafData,
        _mockLoadMetadataData: mockLoadMetadataData,
        _mockRender: mockRender,
      };
    }),
  };
});

describe('Oncoprint Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Issue #1: Loading mafData and metadataData together', () => {
    it('should load both mafData and metadataData without race condition', async () => {
      // Test data from issue #1
      const mafData = [
        {
          Hugo_Symbol: 'TP53',
          Tumor_Sample_Barcode: 'Sample_1',
          Variant_Classification: 'Missense_Mutation'
        },
        {
          Hugo_Symbol: 'BRCA1',
          Tumor_Sample_Barcode: 'Sample_2',
          Variant_Classification: 'Missense_Mutation'
        },
        {
          Hugo_Symbol: 'BRCA2',
          Tumor_Sample_Barcode: 'Sample_3',
          Variant_Classification: 'Missense_Mutation'
        },
      ];

      const metadataData = [
        {
          Tumor_Sample_Barcode: 'Sample_1',
          Diagnosis_Event: 'Diagnosis_Event_1',
        },
        {
          Tumor_Sample_Barcode: 'Sample_2',
          Diagnosis_Event: 'Diagnosis_Event_2',
        },
        {
          Tumor_Sample_Barcode: 'Sample_3',
          Diagnosis_Event: 'Diagnosis_Event_3',
        },
      ];

      const onRenderComplete = jest.fn();

      render(
        <Oncoprint
          mafData={mafData}
          metadataData={metadataData}
          onRenderComplete={onRenderComplete}
        />
      );

      // Wait for async operations to complete
      await waitFor(() => {
        const MockedVisualizer = OncoprintVisualizer as jest.MockedClass<typeof OncoprintVisualizer>;
        const instance = MockedVisualizer.mock.results[0].value;

        // Verify loadMafData was called with the correct data
        expect(instance._mockLoadMafData).toHaveBeenCalledWith(mafData);

        // Verify loadMetadataData was called with the correct data
        expect(instance._mockLoadMetadataData).toHaveBeenCalledWith(metadataData);

        // Verify render was called
        expect(instance._mockRender).toHaveBeenCalled();
      });

      // Verify callback was called
      await waitFor(() => {
        expect(onRenderComplete).toHaveBeenCalled();
      });
    });

    it('should load mafData and metadataData sequentially (not in parallel)', async () => {
      const mafData = [
        {
          Hugo_Symbol: 'TP53',
          Tumor_Sample_Barcode: 'Sample_1',
          Variant_Classification: 'Missense_Mutation'
        },
      ];

      const metadataData = [
        {
          Tumor_Sample_Barcode: 'Sample_1',
          Diagnosis_Event: 'Diagnosis_Event_1',
        },
      ];

      // Track the order of method calls
      const callOrder: string[] = [];

      const MockedVisualizer = OncoprintVisualizer as jest.MockedClass<typeof OncoprintVisualizer>;
      MockedVisualizer.mockImplementation(() => {
        return {
          loadMafData: jest.fn().mockImplementation(() => {
            callOrder.push('loadMafData');
            return Promise.resolve();
          }),
          loadMetadataData: jest.fn().mockImplementation(() => {
            callOrder.push('loadMetadataData');
            return Promise.resolve();
          }),
          render: jest.fn().mockImplementation(() => {
            callOrder.push('render');
          }),
          loadMafFile: jest.fn(),
          loadMetadataFile: jest.fn(),
          on: jest.fn(),
          off: jest.fn(),
          setConfig: jest.fn(),
          updateConfig: jest.fn(),
          resize: jest.fn(),
          exportSVG: jest.fn(),
          destroy: jest.fn(),
        } as any;
      });

      render(
        <Oncoprint
          mafData={mafData}
          metadataData={metadataData}
        />
      );

      await waitFor(() => {
        expect(callOrder.length).toBeGreaterThanOrEqual(3);
      });

      // Verify the correct order: loadMafData -> loadMetadataData -> render
      expect(callOrder[0]).toBe('loadMafData');
      expect(callOrder[1]).toBe('loadMetadataData');
      expect(callOrder[2]).toBe('render');
    });

    it('should render only once when both mafData and metadataData are provided', async () => {
      const mafData = [
        {
          Hugo_Symbol: 'TP53',
          Tumor_Sample_Barcode: 'Sample_1',
          Variant_Classification: 'Missense_Mutation'
        },
      ];

      const metadataData = [
        {
          Tumor_Sample_Barcode: 'Sample_1',
          Diagnosis_Event: 'Diagnosis_Event_1',
        },
      ];

      const mockRender = jest.fn();
      const MockedVisualizer = OncoprintVisualizer as jest.MockedClass<typeof OncoprintVisualizer>;
      MockedVisualizer.mockImplementation(() => {
        return {
          loadMafData: jest.fn().mockResolvedValue(undefined),
          loadMetadataData: jest.fn().mockResolvedValue(undefined),
          render: mockRender,
          loadMafFile: jest.fn(),
          loadMetadataFile: jest.fn(),
          on: jest.fn(),
          off: jest.fn(),
          setConfig: jest.fn(),
          updateConfig: jest.fn(),
          resize: jest.fn(),
          exportSVG: jest.fn(),
          destroy: jest.fn(),
        } as any;
      });

      render(
        <Oncoprint
          mafData={mafData}
          metadataData={metadataData}
        />
      );

      await waitFor(() => {
        // Render should be called exactly once, not multiple times (which would indicate a race condition)
        expect(mockRender).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle errors during data loading', async () => {
      const mafData = [
        {
          Hugo_Symbol: 'TP53',
          Tumor_Sample_Barcode: 'Sample_1',
          Variant_Classification: 'Missense_Mutation'
        },
      ];

      const metadataData = [
        {
          Tumor_Sample_Barcode: 'Sample_1',
          Diagnosis_Event: 'Diagnosis_Event_1',
        },
      ];

      const onError = jest.fn();
      const testError = new Error('Test error during metadata loading');

      const MockedVisualizer = OncoprintVisualizer as jest.MockedClass<typeof OncoprintVisualizer>;
      MockedVisualizer.mockImplementation(() => {
        return {
          loadMafData: jest.fn().mockResolvedValue(undefined),
          loadMetadataData: jest.fn().mockRejectedValue(testError),
          render: jest.fn(),
          loadMafFile: jest.fn(),
          loadMetadataFile: jest.fn(),
          on: jest.fn(),
          off: jest.fn(),
          setConfig: jest.fn(),
          updateConfig: jest.fn(),
          resize: jest.fn(),
          exportSVG: jest.fn(),
          destroy: jest.fn(),
        } as any;
      });

      render(
        <Oncoprint
          mafData={mafData}
          metadataData={metadataData}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(testError);
      });
    });
  });

  describe('Basic functionality', () => {
    it('should render without crashing', () => {
      const { container } = render(<Oncoprint />);
      expect(container).toBeInTheDocument();
    });

    it('should accept mafData prop only', async () => {
      const mafData = [
        {
          Hugo_Symbol: 'TP53',
          Tumor_Sample_Barcode: 'Sample_1',
          Variant_Classification: 'Missense_Mutation'
        },
      ];

      const mockLoadMafData = jest.fn().mockResolvedValue(undefined);
      const MockedVisualizer = OncoprintVisualizer as jest.MockedClass<typeof OncoprintVisualizer>;
      MockedVisualizer.mockImplementation(() => {
        return {
          loadMafData: mockLoadMafData,
          loadMetadataData: jest.fn().mockResolvedValue(undefined),
          render: jest.fn(),
          loadMafFile: jest.fn(),
          loadMetadataFile: jest.fn(),
          on: jest.fn(),
          off: jest.fn(),
          setConfig: jest.fn(),
          updateConfig: jest.fn(),
          resize: jest.fn(),
          exportSVG: jest.fn(),
          destroy: jest.fn(),
        } as any;
      });

      render(<Oncoprint mafData={mafData} />);

      await waitFor(() => {
        expect(mockLoadMafData).toHaveBeenCalledWith(mafData);
      });
    });

    it('should accept custom width and height', () => {
      const { container } = render(<Oncoprint width={800} height={600} />);
      const oncoprintDiv = container.querySelector('div');

      expect(oncoprintDiv).toHaveStyle({ width: '800px', height: '600px' });
    });
  });
});
