import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Gallery } from '../__dev__/Gallery';
import { typography } from '../tokens/typography';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderGallery() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Gallery />
    </SafeAreaProvider>,
  );
}

describe('dev gallery', () => {
  it('renders both schemes side by side', () => {
    renderGallery();

    expect(screen.getByText('Light')).toBeOnTheScreen();
    expect(screen.getByText('Dark')).toBeOnTheScreen();
  });

  it.each([
    'Typography',
    'Button — default / pressed / disabled / loading',
    'IconButton — default / pressed / disabled',
    'Chip — default / selected / pressed / disabled',
    'StatusBadge',
    'Card — static / pressable / pressed / disabled',
    'Input — default / required / helper / error / disabled',
    'BottomSheet',
  ])('covers the %s section in both schemes', (section) => {
    renderGallery();
    expect(screen.getAllByText(section.toUpperCase())).toHaveLength(2);
  });

  it('shows every typography variant in both schemes', () => {
    renderGallery();

    for (const variant of Object.keys(typography)) {
      expect(screen.getAllByText(variant)).toHaveLength(2);
    }
  });

  it('shows the disabled and error states the design system has to cover', () => {
    renderGallery();

    expect(screen.getAllByText('Primary disabled')).toHaveLength(2);
    expect(screen.getAllByText('Secondary disabled')).toHaveLength(2);
    expect(screen.getAllByText('Ghost disabled')).toHaveLength(2);
    expect(screen.getAllByText('Primary loading')).toHaveLength(2);
    expect(screen.getAllByText('Enter a date in the future.')).toHaveLength(2);
  });

  it('renders a pressed preview alongside each interactive component', () => {
    renderGallery();

    expect(screen.getAllByText('Primary pressed')).toHaveLength(2);
    expect(screen.getAllByText('Secondary pressed')).toHaveLength(2);
    expect(screen.getAllByText('Pressed')).toHaveLength(2);
    expect(screen.getAllByText('Pressed card')).toHaveLength(2);
  });
});
