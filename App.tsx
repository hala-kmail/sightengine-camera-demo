import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
// Replaced: CameraScreen (Vision Camera + Frame Processor) with post-capture backend analysis
import ImageQualityAnalyzerScreen from './src/screens/ImageQualityAnalyzerScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <ImageQualityAnalyzerScreen />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
