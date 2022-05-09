import React, { useState, useEffect, useLayoutEffect } from 'react';
// @ts-ignore
import QrCode from 'qrcode.react';
import { getWhistlePort } from '../../utils';
import { Extension } from '../../extension';
import { useTranslation } from 'react-i18next';
import { clipboard } from 'electron';
import { message, Select } from 'antd';
import { get } from 'lodash';
import { LoadingOutlined, StopOutlined } from '@ant-design/icons';

export class PhoneProxy extends Extension {
    constructor() {
        super('phone-proxy');
    }

    panelIcon() {
        return 'scan';
    }

    panelTitle() {
        return 'Phone proxy';
    }

    panelComponent() {
        const PhoneProxy = () => {
            const [enabled, setEnabled] = useState<boolean | 'loading'>('loading');
            const [port, setPort] = useState(null as null | number);
            const [address, setAddress] = useState(
                null as
                    | null
                    | {
                          interface: string;
                          address: string;
                      }[],
            );

            const [currentInterface, setCurrentInterface] = useState('');

            const { t } = useTranslation();

            useEffect(() => {
                const handler = (nextEnabled: boolean | 'loading') => {
                    setEnabled(nextEnabled);
                };
                this.coreAPI.eventEmmitter.on('iproxy-proxy-on-lan-changed', handler);
                
                this.coreAPI.eventEmmitter.emit('iproxy-restart-proxy-switch-lan', true);

                return () => {
                    this.coreAPI.eventEmmitter.off('iproxy-proxy-on-lan-changed', handler);
                }
            }, []);

            useEffect(() => {
                (async () => {
                    const _port = await getWhistlePort(this.coreAPI);
                    setPort(_port);
                })();
            }, []);

            useLayoutEffect(() => {
                (async () => {
                    const _address = await this.coreAPI.getIp();
                    setAddress(_address);
                    setCurrentInterface(get(_address, '0.interface'));
                })();
            }, []);

            const selectedAddress = (address || []).find((item) => item.interface === currentInterface)?.address;

            function copyProxyAddress() {
                clipboard.writeText(`${selectedAddress}:${port}`);
                message.success(t('WIFI proxy address has been copied to the pasteboard'));
            }
            function copyCertAddress() {
                clipboard.writeText(`http://${selectedAddress}:${port}/cgi-bin/rootca`);
                message.success(t('Cert address has been copied to the pasteboard'));
            }

            if (!enabled) {
                return (
                    <div className="iproxy-phoneproxy-container">
                        <div className="iproxy-phoneproxy-status">
                            <StopOutlined className="status-icon" style={{ color: '#f03030' }} />
                            {t('Proxy on LAN disabled')}
                        </div>
                    </div>
                )
            } else if (enabled === 'loading') {
                return (
                    <div className="iproxy-phoneproxy-container">
                        <div className="iproxy-phoneproxy-status">
                            <LoadingOutlined className="status-icon" />
                            {t('Switching Proxy on LAN Status...')}
                        </div>
                    </div>
                )
            }

            return (
                <div className="iproxy-phoneproxy-container">
                    <div className="iproxy-phoneproxy-qrcode">
                        {/* @ts-ignore */}
                        <QrCode size={256} value={`http://${selectedAddress}:${port}/cgi-bin/rootca`}></QrCode>
                    </div>

                    <div className="title">
                        <span className="margin10">{t('Select network interface')}</span>
                        <Select
                            style={{
                                minWidth: '150px',
                            }}
                            value={currentInterface}
                            onChange={(val) => setCurrentInterface(val)}
                        >
                            {address?.map((item) => {
                                return (
                                    <Select.Option key={item.interface} value={item.interface}>
                                        {item.interface}
                                    </Select.Option>
                                );
                            })}
                        </Select>
                    </div>
                    <div className="title">
                        <span className="margin10">{t('Scan to install cert')}</span>
                        <a className="margin10" href={`http://${selectedAddress}:${port}/cgi-bin/rootca`}>
                            {t('Click to download cert')}
                        </a>
                        <a onClick={copyCertAddress}>{t('Click to copy cert link')}</a>
                    </div>
                    <div className="title" onClick={copyProxyAddress}>
                        <span>{t('Setting WIFI proxy to')}</span>
                        <a>{`${selectedAddress}:${port}`}</a>
                    </div>
                </div>
            );
        };

        return PhoneProxy;
    }
}
