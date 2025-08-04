import type { NextPageContext } from 'next'

Error.getInitialProps = (ctx: NextPageContext) => {
  console.log({
    reqUrl: ctx.req?.url,
    asPath: ctx.asPath,
  })
  return {}
}

export default function Error() {
  return <>Error</>
}
