interface StepIndicatorProps {
  activeStep: number;
}

export default function StepIndicator({ activeStep }: StepIndicatorProps) {
  const steps = [
    { number: 1, title: "Upload" },
    { number: 2, title: "Annotate" },
    { number: 3, title: "Review" },
  ];

  return (
    <div className="flex items-center justify-center space-x-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className={`
            flex items-center 
            ${index < steps.length - 1 ? 'w-full' : ''}
          `}>
            <div className={`
              h-7 w-7 rounded-full flex items-center justify-center
              ${activeStep >= step.number 
                ? 'bg-primary text-white' 
                : 'bg-muted text-muted-foreground'}
            `}>
              {step.number}
            </div>
            <div className="ml-2 text-sm font-medium text-foreground">
              {step.title}
            </div>
          </div>
          
          {index < steps.length - 1 && (
            <div className="w-8 h-0.5 bg-muted mx-2"></div>
          )}
        </div>
      ))}
    </div>
  );
}
