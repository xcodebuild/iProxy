import React, { useEffect, useRef } from 'react';
import { Icon as LegacyIcon } from '@ant-design/compatible';
import { Popover, Select, Button, Dropdown, Menu } from 'antd';
import { useTranslation } from 'react-i18next';
import { findDOMNode } from 'react-dom';
import { MenuOutlined } from '@ant-design/icons';

interface Props {
    onFinish: (val: Option) => void;
    onCancel: () => void;
    x: number;
    y: number;
}

const MOCK_PATH = 'github.com/xcodebuild/iproxy';

const options = [
    {
        value: 'js-console',
        title: 'JS Console(with eruda)',
        icon: 'code',
        content: `\${1:${MOCK_PATH}} htmlPrepend://\`
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script>eruda.init();</script>
}\`
`,
    },
    {
        value: 'serve-content',
        title: 'Resposne static content(can be use for mock)',
        icon: 'edit',
        content: `\${1:${MOCK_PATH}} \`\${2:resposne content
multiple line
}\`
`,
    },
    {
        value: 'mock-json',
        title: 'Mock json',
        icon: 'paper-clip',
        content: `\${1:${MOCK_PATH}} \`{
    "\${2:test}": "\${3:value}",
    "key": 5
}
\` resHeaders://\`{
    "Content-type": "application/json"
}
\`
`,
    },
    {
        value: 'add-cors',
        title: 'Add CORS Cross-origin header',
        icon: 'flag',
        content: `\${1:${MOCK_PATH}} resCors://enable
`,
    },
    {
        value: 'mapping-url-by-wildcard',
        title: 'Mapping url by wildcard',
        icon: 'pic-right',
        content: `^\${1:${MOCK_PATH}} \${2:https://g.alicdn.com/another-path/$1}
`,
    },
    {
        value: 'res-delay',
        title: 'Delay response',
        icon: 'coffee',
        content: `\${1:${MOCK_PATH}} resDelay://
`,
    },
    {
        value: 'custom-nodejs-code',
        title: 'Custom nodejs code',
        icon: 'code',
        content: `\${1:${MOCK_PATH}} scriptfile://\`

exports.handleRequest = async (ctx, next) => {
   // do sth
   // ctx.fullUrl 可以获取请求url
   // ctx.headers 可以获取请求头
   // ctx.options 里面包含一些特殊的请求头字段，分别可以获取一些额外信息，如请设置的规则等
   // ctx.method 获取和设置请求方法
   // const reqBody = await ctx.getReqBody(); 获取请求body的Buffer数据，如果没有数据返回null
   // const reqText = await ctx.getReqText();  获取请求body的文本，如果没有返回''
   // const formData = await ctx.getReqForm(); 获取表单对象，如果不是表单，返回空对象{}
   // ctx.req.body = String| Buffer | Stream | null，修改请求的内容
   // next方法可以设置next({ host, port });
   // 只有执行next方法后才可以把正常的请求发送出去
   const { statusCode, headers } = await next(); 
   // do sth
   // const resBody = yield ctx.getResBody();
   // const resText = yield ctx.getResText();
   // ctx.status = 404; 修改响应状态码
   // ctx.set(headers); 批量修改响应头
   // ctx.set('x-test', 'abc'); 修改响应头
   // ctx.body = String| Buffer | Stream | null; 修改响应内容
   ctx.body = 'test';
 };\`
`,
    },
];

export type Option = typeof options[0];

export const Card = (props: Props) => {
    const { onFinish, onCancel, x, y } = props;

    const selectRef = useRef(null as any);

    const { t } = useTranslation();

    useEffect(() => {
        /* eslint-disable-next-line */
        const domNode = findDOMNode(selectRef.current) as HTMLElement
        domNode?.click();
    }, []);

    return (
        <Dropdown
            overlay={
                <Menu>
                     {options.map(item => {
                        return (
                            <Menu.Item key={item.value} onClick={() => {
                                const option = options.find(findItem => findItem.value === item.value) as Option;
                                onFinish(option);
                            }}>
                                <div className="iproxy-select-item">
                                    <span className="iproxy-select-icon">
                                        <LegacyIcon type={item.icon}></LegacyIcon>
                                    </span>
                                    <span className="iproxy-select-title">{t(item.title)}</span>
                                </div>
                            </Menu.Item>
                        );
                    })}
                </Menu>
            }
        >
            <Button
                style={{
                    left: x,
                    top: y,
                    position: 'absolute',
                }}
                size="small"
                shape="circle"
                icon={<MenuOutlined />}>
            </Button>
        </Dropdown>
        
    );
};
