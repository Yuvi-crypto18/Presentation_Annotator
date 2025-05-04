import { Switch, Route } from "wouter";
import Home from "@/pages/Home";
import SlideAnnotation from "@/pages/SlideAnnotation";
import ReviewAnnotations from "@/pages/ReviewAnnotations";
import Success from "@/pages/Success";
import NotFound from "@/pages/not-found";

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-card py-4 px-6 border-b border-muted">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold text-white">PowerPoint Annotation Tool</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/annotate/:presentationId" component={SlideAnnotation} />
            <Route path="/review/:presentationId" component={ReviewAnnotations} />
            <Route path="/success" component={Success} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>

      <footer className="bg-card py-4 px-6 border-t border-muted">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-muted-foreground text-center">PowerPoint Annotation Tool © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
