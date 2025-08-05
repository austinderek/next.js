interface Props {
  color: string
}

export default (p: Props) => (
  <div>
    <p>test</p>
    <style jsx>{`
      span {
        color: ${p.color};
      }
    `}</style>
  </div>
)
