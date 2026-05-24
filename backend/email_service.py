import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import threading
import logging
import traceback
from mongodb_service import mongodb_service

logger = logging.getLogger('email_service')
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('[%(levelname)s] %(name)s: %(message)s'))
if not logger.handlers:
    logger.addHandler(handler)

def send_fusion_report_email(patient_id, report_data):
    """
    Sends an email to the patient with their Fusion Report details.
    Runs asynchronously in a thread.
    """
    logger.info(f"Initiating email dispatch for patient_id: {patient_id}")
    sender_email = os.environ.get("SMTP_EMAIL")
    sender_password = os.environ.get("SMTP_PASSWORD")
    
    if not sender_email or not sender_password or sender_email == "your_email@gmail.com":
        logger.warning(f"SMTP credentials missing or default in .env (email: {sender_email}). Skipping dispatch.")
        return
        
    def _send():
        try:
            logger.debug(f"Thread started. Fetching user info for {patient_id} from DB...")
            # Look up the user email based on patient_id
            user = mongodb_service.get_user_by_id(patient_id)
            if not user or not user.get('email'):
                logger.warning(f"No email address found for user {patient_id}. Skipping.")
                return
                
            recipient_email = user.get('email')
            logger.info(f"Preparing to build email for recipient: {recipient_email}")
            
            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = recipient_email
            msg['Subject'] = "Your NeuroCare Fusion Assessment Report"

            patient_details = report_data.get('patientDetails', {})
            ai_results = report_data.get('aiResults', {})
            
            # Unpack details
            name = patient_details.get('full_name') or 'Patient'
            age = patient_details.get('age') or 'N/A'
            gender = patient_details.get('gender') or 'N/A'
            bmi = patient_details.get('bmi')
            bmi_display = f"{bmi} ({patient_details.get('bmiClass', '')})" if bmi else 'N/A'
            weight = patient_details.get('weightKg') or 'N/A'
            height = patient_details.get('heightCm') or 'N/A'
            
            summary = ai_results.get('summary', {})
            risk_score = summary.get('riskScore', 'N/A')
            if type(risk_score) in (float, int):
                risk_score = f"{risk_score:.1f}"
                
            risk_level = summary.get('riskLevel', 'N/A')
            confidence = summary.get('confidence', 0.0)
            
            logger.debug(f"Report unpacked: {risk_level} at {confidence * 100:.1f}%. Building HTML...")
            
            # Provide an inline styling that looks professional
            html = f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1c3a61; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">NeuroCare - Fusion Assessment Report</h2>
                    <p>Dear {name},</p>
                    <p>Your recent multi-modal Fusion Assessment has been securely processed and successfully saved to your clinical record.</p>
                    
                    <div style="background: #f8fafc; padding: 15px 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">Vitals & Registered Profile</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Age</strong></td><td style="padding: 4px 0;">{age} years</td></tr>
                            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Gender</strong></td><td style="padding: 4px 0;">{gender}</td></tr>
                            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Weight</strong></td><td style="padding: 4px 0;">{weight} kg</td></tr>
                            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Height</strong></td><td style="padding: 4px 0;">{height} cm</td></tr>
                            <tr><td style="padding: 4px 0; color: #64748b;"><strong>BMI</strong></td><td style="padding: 4px 0;">{bmi_display}</td></tr>
                        </table>
                    </div>

                    <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #166534; font-size: 16px;">Screening Results</h3>
                        <p style="margin: 0 0 10px 0;">The system analyzed multiple testing modalities to compute a unified assessment.</p>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 4px 0; color: #166534;"><strong>Risk Classification</strong></td><td style="padding: 4px 0; font-weight: bold;">{risk_level} Risk</td></tr>
                            <tr><td style="padding: 4px 0; color: #166534;"><strong>Overall Score</strong></td><td style="padding: 4px 0; font-weight: bold;">{risk_score} / 10</td></tr>
                            <tr><td style="padding: 4px 0; color: #166534;"><strong>AI Confidence</strong></td><td style="padding: 4px 0;">{confidence * 100:.1f}%</td></tr>
                        </table>
                    </div>
                    
                    <p style="font-size: 14px;">Sign in to your dashboard to view the full PDF report formatting and detailed modality breakdown.</p>
                    
                    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #64748b;">
                        <strong>Disclaimer:</strong> This report provides AI-assisted screening analysis and does not constitute a clinical diagnosis. Always consult your neurologist or primary care physician for medical advice and interpretation of these scores.
                    </div>
                </body>
            </html>
            """
            
            msg.attach(MIMEText(html, 'html'))
            
            # Connect and send
            logger.info("Connecting to smtp.gmail.com on port 587...")
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.set_debuglevel(1)  # Enables detailed SMTP protocol log output to terminal
            server.starttls()
            logger.debug(f"Attempting SMTP login as {sender_email}...")
            server.login(sender_email, sender_password)
            logger.debug("SMTP login successful. Sending message...")
            server.send_message(msg)
            server.quit()
            logger.info(f"Successfully sent Fusion Report email to {recipient_email}")
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP Authentication Error! Your password/app-password might be incorrect: {e}")
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            logger.error(traceback.format_exc())

    # Run in background to avoid blocking API response
    thread = threading.Thread(target=_send)
    thread.daemon = True
    thread.start()
    logger.debug("Email thread started in background.")
