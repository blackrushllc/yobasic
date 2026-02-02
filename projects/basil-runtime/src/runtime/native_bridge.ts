import { Toast } from '@capacitor/toast';

export class NativeBridge {
  static async invoke(plugin: string, method: string, args: any): Promise<any> {
    console.log(`NativeBridge.invoke: ${plugin}.${method}`, args);
    
    if (plugin === 'ui') {
      if (method === 'toast') {
        await Toast.show({
          text: args.message || args[0] || '',
        });
        return true;
      }
    }
    
    throw new Error(`Plugin or method not implemented: ${plugin}.${method}`);
  }
}

// Expose to WebView
(window as any).BasilNative = {
  invoke: NativeBridge.invoke
};
