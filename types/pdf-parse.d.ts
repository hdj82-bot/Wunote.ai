// pdf-parse 는 @types/pdf-parse 가 index 진입점만 선언한다.
// 서버리스 환경에서 모듈 로드 시 테스트 파일을 읽으려는 버그를 피하기 위해
// 내부 구현 경로(lib/pdf-parse.js)를 직접 임포트하므로 해당 서브패스도 선언해둔다.
declare module 'pdf-parse/lib/pdf-parse.js' {
  import type pdfParse from 'pdf-parse'
  export default pdfParse
}
