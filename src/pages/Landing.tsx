import { Link } from 'react-router-dom';
import { BrainCircuit, ShieldCheck, TestTube, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

const FeatureCard = ({ icon, title, description }: { icon: React.ElementType, title: string, description: string }) => {
    const Icon = icon;
    return (
        <div className="bg-card p-6 rounded-lg text-center">
            <Icon className="mx-auto h-12 w-12 text-primary-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
        </div>
    );
}

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16">
        <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
        >
          <BrainCircuit className="mx-auto h-20 w-20 text-primary-foreground mb-4" />
          <h1 className="text-5xl font-bold mb-4">Welcome to NeuroCare</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Advanced AI-powered detection and personalized care for Parkinson's disease. Take control of your health journey today.
          </p>
          <div className="space-x-4">
            <Link to="/login" className="bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-lg hover:bg-opacity-90 transition-colors">
              Get Started
            </Link>
          </div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid md:grid-cols-3 gap-8 mt-24"
        >
            <FeatureCard icon={TestTube} title="AI-Powered Analysis" description="Utilize cutting-edge models to analyze voice, handwriting, and facial data for early detection." />
            <FeatureCard icon={ShieldCheck} title="Secure & Private" description="Your health data is encrypted and stored with bank-grade security. You are in control." />
            <FeatureCard icon={MessageSquare} title="Comprehensive Care" description="From diagnosis to management, get reports, consult doctors, and get assistance from our AI." />
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
