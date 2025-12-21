export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="footer">
            <p className="footer-copy">© {year} G-MAI. All rights reserved.</p>
        </footer>
    );
}
