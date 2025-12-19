import { BrowserRouter, Routes, Route } from "react-router-dom";
import { IndexPage } from "./pages/IndexPage";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<IndexPage />} />
    </Routes>
  </BrowserRouter>
);

export default App;
