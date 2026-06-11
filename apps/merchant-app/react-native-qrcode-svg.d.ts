// apps/merchant-app/react-native-qrcode-svg.d.ts
declare module "react-native-qrcode-svg" {
  import { Component } from "react";
  interface QRCodeProps {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    logo?: any;
    logoSize?: number;
    logoMargin?: number;
    logoBorderRadius?: number;
    logoBackgroundColor?: string;
    quietZone?: number;
  }
  export default class QRCode extends Component<QRCodeProps> {}
}
