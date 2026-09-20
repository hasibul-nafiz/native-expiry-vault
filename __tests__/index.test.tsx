import { render, screen } from '@testing-library/react-native';

import HomeScreen from '../app/index';

test('renders the app name', () => {
  render(<HomeScreen />);
  expect(screen.getByText('ExpiryVault')).toBeOnTheScreen();
});
