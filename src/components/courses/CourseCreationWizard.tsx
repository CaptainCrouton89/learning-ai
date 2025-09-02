"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Upload, Sparkles, Clock, Brain } from "lucide-react";
import { Course } from "@/types/course";

interface CourseCreationWizardProps {
  onComplete: (courseData: Omit<CourseCreationData, "step">) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface CourseCreationData {
  step: number;
  topic: string;
  documentContent?: string;
  timeAvailable: string;
  existingUnderstanding: string;
  focusDescription: string;
  learningGoals?: string[];
  selectedGoal?: string;
}

const TIME_OPTIONS = [
  { value: "<15min", label: "Micro-learning - Under 15 minutes" },
  { value: "15-60min", label: "Quick session - 15-60 minutes" },
  { value: "1-6hours", label: "Standard learning - 1-6 hours" },
  { value: "6-12hours", label: "Deep dive - 6-12 hours" },
  { value: "12hours+", label: "Comprehensive mastery - 12+ hours" },
];

const UNDERSTANDING_OPTIONS = [
  { value: "None - Complete beginner", label: "None - Complete beginner" },
  { value: "Some - I know the basics", label: "Some - I know the basics" },
  { value: "Strong - I want advanced insights", label: "Strong - I want advanced insights" },
];

export function CourseCreationWizard({ onComplete, onCancel, isLoading }: CourseCreationWizardProps) {
  const [data, setData] = useState<CourseCreationData>({
    step: 1,
    topic: "",
    timeAvailable: "",
    existingUnderstanding: "",
    focusDescription: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateData = (updates: Partial<CourseCreationData>) => {
    setData(prev => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    if (errors) {
      const newErrors = { ...errors };
      Object.keys(updates).forEach(key => delete newErrors[key]);
      setErrors(newErrors);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1:
        if (!data.topic.trim()) {
          newErrors.topic = "Please enter a topic to learn about";
        }
        break;
      case 2:
        if (!data.timeAvailable) {
          newErrors.timeAvailable = "Please select how much time you have";
        }
        break;
      case 3:
        if (!data.existingUnderstanding) {
          newErrors.existingUnderstanding = "Please select your current understanding level";
        }
        break;
      case 4:
        if (!data.focusDescription.trim() || data.focusDescription.length < 10) {
          newErrors.focusDescription = "Please describe what you want to focus on (at least 10 characters)";
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(data.step)) {
      updateData({ step: data.step + 1 });
    }
  };

  const prevStep = () => {
    updateData({ step: data.step - 1 });
  };

  const handleSubmit = () => {
    if (validateStep(4)) {
      const { step, ...courseData } = data;
      onComplete(courseData);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const file = files?.[0];
    if (file) {
      try {
        const content = await file.text();
        updateData({ documentContent: content });
      } catch (error) {
        setErrors({ file: "Failed to read file. Please try again." });
      }
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          What would you like to learn?
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Choose a topic from your knowledge or upload a document to learn from.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            placeholder="e.g., JavaScript fundamentals, Wine tasting, Machine learning..."
            value={data.topic}
            onChange={(e) => updateData({ topic: e.target.value })}
            className={errors.topic ? "border-destructive" : ""}
          />
          {errors.topic && (
            <p className="text-sm text-destructive">{errors.topic}</p>
          )}
        </div>

        <Separator className="my-6" />

        <div className="space-y-2">
          <Label htmlFor="document">Or upload a document (optional)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="document"
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
            <Upload className="w-4 h-4 text-muted-foreground" />
          </div>
          {data.documentContent && (
            <Badge variant="secondary">Document uploaded successfully</Badge>
          )}
          {errors.file && (
            <p className="text-sm text-destructive">{errors.file}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          How much time do you have?
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          This helps us create the right amount of content for your session.
        </p>
      </div>

      <div className="grid gap-3">
        {TIME_OPTIONS.map((option) => (
          <div
            key={option.value}
            className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
              data.timeAvailable === option.value ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => updateData({ timeAvailable: option.value })}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{option.label}</span>
              {data.timeAvailable === option.value && (
                <Badge variant="default">Selected</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
      {errors.timeAvailable && (
        <p className="text-sm text-destructive">{errors.timeAvailable}</p>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          What's your current understanding?
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Tell us about your existing knowledge of "{data.topic}".
        </p>
      </div>

      <div className="grid gap-3">
        {UNDERSTANDING_OPTIONS.map((option) => (
          <div
            key={option.value}
            className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
              data.existingUnderstanding === option.value ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => updateData({ existingUnderstanding: option.value })}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{option.label}</span>
              {data.existingUnderstanding === option.value && (
                <Badge variant="default">Selected</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
      {errors.existingUnderstanding && (
        <p className="text-sm text-destructive">{errors.existingUnderstanding}</p>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          What do you want to focus on?
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Describe what aspects of "{data.topic}" you want to learn most about.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="focus">Learning focus</Label>
          <textarea
            id="focus"
            placeholder="e.g., I want to understand the basics and practical applications..."
            value={data.focusDescription}
            onChange={(e) => updateData({ focusDescription: e.target.value })}
            className={`w-full min-h-[120px] p-3 border rounded-md text-sm ${
              errors.focusDescription ? "border-destructive" : ""
            }`}
            rows={5}
          />
          {errors.focusDescription && (
            <p className="text-sm text-destructive">{errors.focusDescription}</p>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Examples:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>"I want to understand the basics and practical applications"</li>
            <li>"Help me master advanced techniques and edge cases"</li>
            <li>"I need to learn how to troubleshoot common problems"</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Ready to create your course!
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          We'll create a personalized learning experience based on your preferences.
        </p>
      </div>

      <div className="space-y-4 p-4 bg-muted rounded-lg">
        <div className="space-y-2">
          <h4 className="font-medium">Course Summary:</h4>
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Topic:</span> {data.topic}</p>
            <p><span className="font-medium">Time available:</span> {TIME_OPTIONS.find(t => t.value === data.timeAvailable)?.label}</p>
            <p><span className="font-medium">Understanding level:</span> {data.existingUnderstanding}</p>
            <p><span className="font-medium">Focus:</span> {data.focusDescription}</p>
            {data.documentContent && (
              <p><span className="font-medium">Document:</span> Uploaded successfully</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const totalSteps = 5;
  const progress = (data.step / totalSteps) * 100;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Create New Course</h2>
            <p className="text-sm text-muted-foreground">
              Step {data.step} of {totalSteps}
            </p>
          </div>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      <CardContent>
        {data.step === 1 && renderStep1()}
        {data.step === 2 && renderStep2()}
        {data.step === 3 && renderStep3()}
        {data.step === 4 && renderStep4()}
        {data.step === 5 && renderStep5()}

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={data.step === 1 || isLoading}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          {data.step < totalSteps ? (
            <Button
              onClick={nextStep}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? "Creating..." : "Create Course"}
              <Sparkles className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}