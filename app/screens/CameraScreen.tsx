import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import { io } from 'socket.io-client';

export default function CameraScreen() {
  const cameraRef = useRef(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const socket = useRef(null);
  let imageQueue = [];

  useEffect(() => {
    socket.current = io('ws://192.168.100.58:5000', {
      transports: ['websocket'], 
      reconnection: true, 
      reconnectionAttempts: 10, 
      reconnectionDelay: 2000, 
    });

    socket.current.on('connect', () => {
      console.log('Connected to WebSocket server');
      processQueue();
    });

    socket.current.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    socket.current.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    socket.current.on('analysis_result', (result) => {
      console.log('Received analysis result:', result);
    });

    return () => {
      socket.current.disconnect();
    };
  }, []);

  const processQueue = () => {
    if (imageQueue.length > 0 && socket.current.connected) {
      const image = imageQueue.shift();
      socket.current.emit('send_frame', image);
    }
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (socket.current.connected) {
        captureAndSendPhoto();
      } else {
        console.log("WebSocket not connected, skipping capture.");
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [device]);

  const captureAndSendPhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePhoto();
        console.log("Captured Photo:", photo);

        const resizedImage = await ImageResizer.createResizedImage(photo.path, 800, 800, 'JPEG', 70);
        const fileData = await RNFS.readFile(resizedImage.uri, 'base64');
        if (fileData) {
          imageQueue.push(fileData);
          processQueue();
        }
      } catch (error) {
        console.error('Error capturing or queuing photo:', error);
      }
    }
  };

  if (!hasPermission) return requestPermission();
  if (device == null) return <Text style={{ color: '#000' }}>No Device</Text>;

  return (
    <View style={{ flex: 1 }}>
      <Camera
        ref={cameraRef}
        style={{ flex: 1 }}
        device={device}
        isActive={true}
        photo={true}
      />
    </View>
  );
}
