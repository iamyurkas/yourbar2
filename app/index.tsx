import { Redirect } from 'expo-router';

import { getStartScreenPath } from '../libs/start-screen';
import { useStartScreenPreference } from '../providers/start-screen-provider';

export default function Index() {
  const { startScreen, loading } = useStartScreenPreference();

  if (loading) {
    return null;
  }

  return <Redirect href={getStartScreenPath(startScreen)} />;
}
