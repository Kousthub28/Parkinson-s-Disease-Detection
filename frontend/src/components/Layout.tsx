import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      {/* Organic Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-primary/5 blur-[100px] blob-1 opacity-70" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-secondary/5 blur-[120px] blob-2 opacity-60" />
        <div className="absolute top-[30%] left-[20%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] bg-accent/30 blur-[80px] blob-3 opacity-50" />
      </div>

      <Navbar />
      
      {/* 
        Main content area 
        pt-32 accounts for the fixed top-4 navbar (top-4 = 1rem, navbar approx h-16 = 4rem, plus padding)
      */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
        {children}
      </main>
    </div>
  );
};

export default Layout;
