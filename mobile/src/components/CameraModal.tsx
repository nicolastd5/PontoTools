import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onCapture: (uri: string) => void;
  onCancel: () => void;
  facing?: 'front' | 'back';
}

export default function CameraModal({ visible, onCapture, onCancel, facing: initialFacing = 'back' }: Props) {
  const { theme } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<'front' | 'back'>(initialFacing);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice(facing);

  const handleRequestPermission = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  const capture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'balanced',
        flash: 'off',
      });
      const uri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
      onCapture(uri);
    } catch {
      // silently ignore capture errors
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCapture]);

  if (!visible) return null;

  if (!hasPermission) {
    return (
      <View style={[styles.overlay, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
          Permissão de câmera necessária
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.accent }]}
          onPress={handleRequestPermission}
        >
          <Text style={styles.btnText}>Permitir câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.elevated, marginTop: 10 }]} onPress={onCancel}>
          <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.overlay, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={{ color: '#fff', marginTop: 12 }}>Iniciando câmera...</Text>
        <TouchableOpacity style={{ marginTop: 24 }} onPress={onCancel}>
          <Text style={{ color: '#aaa' }}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={visible}
        photo
      />

      {/* Botão fechar */}
      <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Botão trocar câmera */}
      <TouchableOpacity
        style={styles.switchBtn}
        onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
      >
        <Text style={styles.switchBtnText}>⇄</Text>
      </TouchableOpacity>

      {/* Botão capturar */}
      <View style={styles.captureRow}>
        <TouchableOpacity
          style={[styles.captureBtn, capturing && { opacity: 0.5 }]}
          onPress={capture}
          disabled={capturing}
        >
          {capturing
            ? <ActivityIndicator color="#fff" />
            : <View style={styles.captureInner} />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, zIndex: 999, backgroundColor: '#000' },
  closeBtn:     { position: 'absolute', top: 48, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  switchBtn:    { position: 'absolute', top: 48, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  switchBtnText:{ color: '#fff', fontSize: 20, fontWeight: 'bold' },
  captureRow:   { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  captureBtn:   { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },
  btn:          { borderRadius: 10, padding: 14, paddingHorizontal: 32, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
});
